package com.trucoclub.controller;

import com.trucoclub.entity.Usuario;
import com.trucoclub.seguridad.SupabaseJwtVerifier;
import com.trucoclub.service.UsuarioService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

/**
 * El registro y el login se hacen en el front con Supabase Auth (email o Google).
 * Acá queda lo que se necesita antes de tener perfil de jugador (no pasan por AuthInterceptor):
 *
 *  GET  /api/auth/disponible?username=joaco&dni=30123456
 *       -> {disponible: true}  o  {disponible: false, motivo: "..."} (revisa el nombre y, si viene, el DNI)
 *  POST /api/auth/completar-perfil  {username}   (con el token de Supabase)
 *       -> crea el perfil de quien entró con Google y todavía no eligió nombre de usuario
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UsuarioService usuarioService;
    private final SupabaseJwtVerifier verifier;

    public AuthController(UsuarioService usuarioService, SupabaseJwtVerifier verifier) {
        this.usuarioService = usuarioService;
        this.verifier = verifier;
    }

    @GetMapping("/disponible")
    public Map<String, Object> disponible(@RequestParam(required = false) String username,
                                          @RequestParam(required = false) String dni) {
        String problema = usuarioService.problemaConNombre(username);
        if (problema == null && dni != null) problema = usuarioService.problemaConDni(dni);
        Map<String, Object> r = new HashMap<>();
        r.put("disponible", problema == null);
        if (problema != null) r.put("motivo", problema);
        return r;
    }

    public record CompletarPerfil(String username) {
    }

    @PostMapping("/completar-perfil")
    public Map<String, String> completarPerfil(@RequestHeader(value = "Authorization", required = false) String authorization,
                                               @RequestBody(required = false) CompletarPerfil pedido) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Iniciá sesión para continuar.");
        }
        var datos = verifier.verificarDatos(authorization.substring(7).trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tu sesión venció. Volvé a iniciar sesión."));
        try {
            Usuario u = usuarioService.crearPerfil(datos.id(), datos.email(), pedido == null ? null : pedido.username());
            return Map.of("username", u.getUsername());
        } catch (DataIntegrityViolationException e) {
            // dos personas eligiendo el mismo nombre en el mismo instante
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ese nombre ya lo usa otro jugador.");
        }
    }
}
