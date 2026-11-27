package com.trucoclub.service;

import com.trucoclub.entity.Usuario;
import com.trucoclub.repository.UsuarioRepository;
import org.mindrot.jbcrypt.BCrypt;
import com.trucoclub.entity.EstadoMesa;
import com.trucoclub.repository.MesaApuestaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.EnumSet;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class UsuarioService {

    /** Nombres de usuario: de 3 a 20 letras, números, guion bajo o punto. */
    private static final Pattern NOMBRE_VALIDO = Pattern.compile("[A-Za-z0-9_.]{3,20}");
    public static final String REGLA_NOMBRE = "El nombre tiene que tener de 3 a 20 caracteres: letras, números, _ o punto.";

    private final UsuarioRepository usuarioRepository;
    private final MesaApuestaRepository mesaRepository;

    // Inyección por constructor (la forma limpia de Spring)
    public UsuarioService(UsuarioRepository usuarioRepository, MesaApuestaRepository mesaRepository) {
        this.usuarioRepository = usuarioRepository;
        this.mesaRepository = mesaRepository;
    }

    /** El usuario tal como está guardado (con sus mayúsculas reales). */
    public Optional<Usuario> buscar(String username) {
        return username == null ? Optional.empty() : usuarioRepository.findByUsername(username.trim());
    }

    /**
     * Cambia el nombre de usuario. Pide la contraseña para confirmar, y no deja hacerlo con una mesa
     * abierta o en juego (las partidas usan el nombre). Los depósitos, retiros y partidas viejas siguen
     * siendo suyos porque están atados al id, no al nombre. Devuelve el usuario actualizado.
     */
    @Transactional
    public Usuario cambiarNombre(String actual, String nuevo, String password) {
        String nombre = nuevo == null ? "" : nuevo.trim();
        if (!NOMBRE_VALIDO.matcher(nombre).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, REGLA_NOMBRE);
        }
        Usuario usuario = usuarioRepository.buscarParaActualizarSaldo(actual)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe el usuario"));
        if (password == null || !BCrypt.checkpw(password, usuario.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La contraseña no es correcta.");
        }
        if (nombre.equals(usuario.getUsername())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ese ya es tu nombre.");
        }
        // Puede ser el mismo nombre con otras mayúsculas (joaco -> Joaco); si no, tiene que estar libre
        boolean soloMayusculas = nombre.equalsIgnoreCase(usuario.getUsername());
        if (!soloMayusculas && usuarioRepository.existsByUsername(nombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ese nombre ya lo usa otro jugador.");
        }
        if (mesaRepository.contarDeUsuario(usuario.getUsername(), EnumSet.of(EstadoMesa.ESPERANDO, EstadoMesa.JUGANDO)) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No podés cambiarte el nombre mientras tenés una mesa abierta o en juego.");
        }
        usuario.setUsername(nombre);
        return usuarioRepository.save(usuario);
    }

    public String registrar(String username, String email, String passwordRaw) {
        username = username == null ? "" : username.trim();
        if (!NOMBRE_VALIDO.matcher(username).matches()) {
            return REGLA_NOMBRE;
        }
        // 1. Validar si ya existe el nombre de usuario o email
        if (usuarioRepository.existsByUsername(username)) {
            return "El nombre de usuario ya está en uso";
        }
        if (usuarioRepository.existsByEmail(email)) {
            return "El email ya está registrado";
        }

        // 2. Encriptar la contraseña (¡nunca guardar en texto plano!)
        String passwordEncriptada = BCrypt.hashpw(passwordRaw, BCrypt.gensalt());

        // 3. Crear y guardar la entidad
        Usuario nuevoUsuario = new Usuario();
        nuevoUsuario.setUsername(username);
        nuevoUsuario.setEmail(email);
        nuevoUsuario.setPassword(passwordEncriptada);

        usuarioRepository.save(nuevoUsuario);
        return "OK";
    }

    public String login(String username, String password){
        var usuarioOpt = usuarioRepository.findByUsername(username);
        if (usuarioOpt.isEmpty()) {
            return "Usuario no encontrado";
        }
        Usuario usuario = usuarioOpt.get();
        if (BCrypt.checkpw(password, usuario.getPassword())) {
            if (usuario.estaBloqueado()) {
                String motivo = usuario.getMotivoBloqueo();
                return "Tu cuenta está suspendida" + (motivo == null || motivo.isBlank() ? "." : ": " + motivo);
            }
            return "Login exitoso";
        }
        else {
            return "Error: Contraseña incorrecta";
        }
    }

    /** JUGADOR o ADMIN (el front lo usa solo para mostrar o no el panel; el servidor lo vuelve a chequear). */
    public String rolDe(String username) {
        return usuarioRepository.findByUsername(username).map(u -> u.getRol().name()).orElse("JUGADOR");
    }
}
