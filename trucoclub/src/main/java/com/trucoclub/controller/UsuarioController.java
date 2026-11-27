package com.trucoclub.controller;

import com.trucoclub.dto.PerfilUsuario;
import com.trucoclub.entity.Usuario;
import com.trucoclub.repository.UsuarioRepository;
import com.trucoclub.seguridad.AuthInterceptor;
import com.trucoclub.service.UsuarioService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Map;

/**
 *  GET /api/usuarios/yo  -> mi perfil (nombre, foto, saldo, rol). El usuario sale del token,
 *                           así que nadie puede ver el saldo de otro.
 *  POST /api/usuarios/yo/nombre {nombre} -> cambia el nombre de usuario
 *  POST /api/usuarios/yo/dni {dni}       -> carga el DNI (solo si todavía no tiene; después lo cambia un admin)
 */
@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    /** Lo que manda el front para cambiar el nombre. */
    public record CambioNombre(String nombre) {
    }

    private final UsuarioRepository usuarioRepository;
    private final UsuarioService usuarioService;

    public UsuarioController(UsuarioRepository usuarioRepository, UsuarioService usuarioService) {
        this.usuarioRepository = usuarioRepository;
        this.usuarioService = usuarioService;
    }

    public record CargaDni(String dni) {
    }

    @PostMapping("/yo/dni")
    public Map<String, String> cargarDni(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario,
                                         @RequestBody CargaDni pedido) {
        Usuario u = usuarioService.cargarDni(usuario, pedido == null ? null : pedido.dni());
        return Map.of("dni", u.getDni());
    }

    /** La sesión sigue igual: el token de Supabase identifica al usuario por su id, no por el nombre. */
    @PostMapping("/yo/nombre")
    public Map<String, String> cambiarNombre(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario,
                                             @RequestBody CambioNombre pedido) {
        Usuario u = usuarioService.cambiarNombre(usuario, pedido == null ? null : pedido.nombre());
        return Map.of("username", u.getUsername());
    }

    @GetMapping("/yo")
    public PerfilUsuario yo(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario) {
        return usuarioRepository.findByUsername(usuario)
                .map(u -> new PerfilUsuario(
                        u.getUsername(),
                        u.getFotoUrl(),
                        u.getSaldo() == null ? BigDecimal.ZERO : u.getSaldo(), // usuarios viejos sin saldo
                        u.getPartidasGanadas() == null ? 0 : u.getPartidasGanadas(),
                        u.getRol().name(),
                        u.getDni()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe el usuario " + usuario));
    }
}
