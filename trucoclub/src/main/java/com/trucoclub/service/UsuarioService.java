package com.trucoclub.service;

import com.trucoclub.entity.EstadoMesa;
import com.trucoclub.entity.Usuario;
import com.trucoclub.repository.MesaApuestaRepository;
import com.trucoclub.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.EnumSet;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Perfiles de jugador. El registro, el login y las contraseñas los maneja Supabase Auth:
 * al registrarse, un trigger de la base crea el perfil en trucoclub.usuarios (ver esquema_supabase.sql).
 */
@Service
public class UsuarioService {

    /** Nombres de usuario: de 3 a 20 letras, números, guion bajo o punto (la base exige lo mismo). */
    private static final Pattern NOMBRE_VALIDO = Pattern.compile("[A-Za-z0-9_.]{3,20}");
    public static final String REGLA_NOMBRE = "El nombre tiene que tener de 3 a 20 caracteres: letras, números, _ o punto.";

    private final UsuarioRepository usuarioRepository;
    private final MesaApuestaRepository mesaRepository;

    public UsuarioService(UsuarioRepository usuarioRepository, MesaApuestaRepository mesaRepository) {
        this.usuarioRepository = usuarioRepository;
        this.mesaRepository = mesaRepository;
    }

    /** El usuario tal como está guardado (con sus mayúsculas reales). */
    public Optional<Usuario> buscar(String username) {
        return username == null ? Optional.empty() : usuarioRepository.findByUsername(username.trim());
    }

    /** Para el registro: null si el nombre se puede usar, o el motivo por el que no. */
    @Transactional(readOnly = true)
    public String problemaConNombre(String nombre) {
        String n = nombre == null ? "" : nombre.trim();
        if (!NOMBRE_VALIDO.matcher(n).matches()) return REGLA_NOMBRE;
        if (usuarioRepository.existsByUsernameIgnoreCase(n)) return "Ese nombre ya lo usa otro jugador.";
        return null;
    }

    /**
     * Crea el perfil de TrucoClub de alguien que entró con Google (u otro proveedor) y acaba de elegir
     * su nombre de usuario. El DNI se le pide después, la primera vez que deposita o retira.
     */
    @Transactional
    public Usuario crearPerfil(java.util.UUID authId, String email, String nombre) {
        if (usuarioRepository.findByAuthId(authId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya elegiste tu nombre de usuario.");
        }
        String problema = problemaConNombre(nombre);
        if (problema != null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, problema);
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tu cuenta no tiene email. Probá registrarte con email y contraseña.");
        }
        if (usuarioRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya hay otra cuenta con ese email.");
        }
        Usuario u = new Usuario();
        u.setAuthId(authId);
        u.setUsername(nombre.trim());
        u.setEmail(email);
        u.setFechaRegistro(com.trucoclub.entity.Movimiento.ahora());
        return usuarioRepository.save(u);
    }

    /** Deja solo los números ("30.123.456" -> "30123456"). */
    public static String limpiarDni(String dni) {
        return dni == null ? "" : dni.replaceAll("[^0-9]", "");
    }

    /** Para el registro: null si el DNI se puede usar, o el motivo por el que no. */
    @Transactional(readOnly = true)
    public String problemaConDni(String dni) {
        String d = limpiarDni(dni);
        if (!d.matches("[0-9]{7,8}")) return "El DNI tiene que tener 7 u 8 números.";
        if (usuarioRepository.existsByDni(d)) return "Ya hay una cuenta con ese DNI.";
        return null;
    }

    /**
     * Carga el DNI de una cuenta que no lo tiene (las creadas antes de pedirlo).
     * Si ya tiene uno, no se puede cambiar desde acá: lo corrige un admin en la base.
     */
    @Transactional
    public Usuario cargarDni(String username, String dni) {
        Usuario usuario = usuarioRepository.buscarParaActualizarSaldo(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe el usuario"));
        if (usuario.getDni() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya tenés un DNI cargado. Para cambiarlo, escribinos a soporte.");
        }
        String problema = problemaConDni(dni);
        if (problema != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, problema);
        }
        usuario.setDni(limpiarDni(dni));
        return usuarioRepository.save(usuario);
    }

    /**
     * Cambia el nombre de usuario. No se puede con una mesa abierta o en juego (las partidas usan el nombre).
     * La sesión no se ve afectada: el token de Supabase identifica al usuario por su id, no por el nombre.
     * Los depósitos, retiros y partidas siguen siendo suyos porque están atados al id.
     */
    @Transactional
    public Usuario cambiarNombre(String actual, String nuevo) {
        String nombre = nuevo == null ? "" : nuevo.trim();
        if (!NOMBRE_VALIDO.matcher(nombre).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, REGLA_NOMBRE);
        }
        Usuario usuario = usuarioRepository.buscarParaActualizarSaldo(actual)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe el usuario"));
        if (nombre.equals(usuario.getUsername())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ese ya es tu nombre.");
        }
        // Puede ser el mismo nombre con otras mayúsculas (joaco -> Joaco); si no, tiene que estar libre
        boolean soloMayusculas = nombre.equalsIgnoreCase(usuario.getUsername());
        if (!soloMayusculas && usuarioRepository.existsByUsernameIgnoreCase(nombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ese nombre ya lo usa otro jugador.");
        }
        if (mesaRepository.contarDeUsuario(usuario.getUsername(), EnumSet.of(EstadoMesa.ESPERANDO, EstadoMesa.JUGANDO)) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No podés cambiarte el nombre mientras tenés una mesa abierta o en juego.");
        }
        usuario.setUsername(nombre);
        return usuarioRepository.save(usuario);
    }
}
