package com.trucoclub.controller;

import com.trucoclub.dto.PerfilUsuario;
import com.trucoclub.entity.Usuario;
import com.trucoclub.repository.UsuarioRepository;
import com.trucoclub.seguridad.AuthInterceptor;
import com.trucoclub.seguridad.JwtService;
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
 *  POST /api/usuarios/yo/nombre {nombre, password} -> cambia el nombre y devuelve un token nuevo
 */
@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    /** Lo que manda el front para cambiar el nombre. */
    public record CambioNombre(String nombre, String password) {
    }

    private final UsuarioRepository usuarioRepository;
    private final UsuarioService usuarioService;
    private final JwtService jwtService;

    public UsuarioController(UsuarioRepository usuarioRepository, UsuarioService usuarioService, JwtService jwtService) {
        this.usuarioRepository = usuarioRepository;
        this.usuarioService = usuarioService;
        this.jwtService = jwtService;
    }

    /** El token viejo deja de valer (tenía el nombre anterior), así que devolvemos uno nuevo. */
    @PostMapping("/yo/nombre")
    public Map<String, String> cambiarNombre(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario,
                                             @RequestBody CambioNombre pedido) {
        Usuario u = usuarioService.cambiarNombre(usuario, pedido == null ? null : pedido.nombre(),
                pedido == null ? null : pedido.password());
        return Map.of("token", jwtService.crear(u.getUsername(), u.getId()), "username", u.getUsername());
    }

    @GetMapping("/yo")
    public PerfilUsuario yo(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario) {
        return usuarioRepository.findByUsername(usuario)
                .map(u -> new PerfilUsuario(
                        u.getUsername(),
                        u.getFotoUrl(),
                        u.getSaldo() == null ? BigDecimal.ZERO : u.getSaldo(), // usuarios viejos sin saldo
                        u.getPartidasGanadas() == null ? 0 : u.getPartidasGanadas(),
                        u.getRol().name()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe el usuario " + usuario));
    }
}
