package com.trucoclub.seguridad;

import com.trucoclub.entity.Usuario;
import com.trucoclub.repository.UsuarioRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Resuelve quién hace cada pedido: valida el token de Supabase Auth, busca el perfil de TrucoClub
 * atado a ese usuario (usuarios.auth_id) y revisa que la cuenta no esté suspendida.
 * El resto del backend sigue trabajando con el nombre de usuario.
 */
@Service
public class SesionService {

    /** Resultado de revisar la sesión: el nombre del usuario o por qué no puede pasar. */
    public record Resultado(String usuario, int status, String mensaje) {
        static Resultado ok(String usuario) { return new Resultado(usuario, 200, null); }
        static Resultado rechazo(int status, String mensaje) { return new Resultado(null, status, mensaje); }
        public boolean valido() { return usuario != null; }
    }

    /** Mensaje que el front reconoce para mandar a elegir el nombre de usuario. */
    public static final String PERFIL_INCOMPLETO = "PERFIL_INCOMPLETO";

    private final SupabaseJwtVerifier verifier;
    private final UsuarioRepository usuarioRepository;

    public SesionService(SupabaseJwtVerifier verifier, UsuarioRepository usuarioRepository) {
        this.verifier = verifier;
        this.usuarioRepository = usuarioRepository;
    }

    public Resultado revisar(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return Resultado.rechazo(401, "Iniciá sesión para continuar.");
        }
        var authId = verifier.verificar(authorization.substring(7).trim());
        if (authId.isEmpty()) return Resultado.rechazo(401, "Tu sesión venció. Volvé a iniciar sesión.");

        Optional<Usuario> perfil = usuarioRepository.findByAuthId(authId.get());
        // Entró con Google y todavía no eligió su nombre de usuario: el front lo manda a completarlo
        if (perfil.isEmpty()) return Resultado.rechazo(409, PERFIL_INCOMPLETO);
        Usuario u = perfil.get();
        if (u.estaBloqueado()) {
            String motivo = u.getMotivoBloqueo();
            return Resultado.rechazo(403, "Tu cuenta está suspendida" + (motivo == null || motivo.isBlank() ? "." : ": " + motivo));
        }
        return Resultado.ok(u.getUsername());
    }

    /** Atajo para el WebSocket: el nombre si puede pasar, vacío si no. */
    public Optional<String> usuarioDe(String authorization) {
        Resultado r = revisar(authorization);
        return r.valido() ? Optional.of(r.usuario()) : Optional.empty();
    }
}
