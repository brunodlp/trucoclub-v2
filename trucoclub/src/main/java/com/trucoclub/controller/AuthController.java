package com.trucoclub.controller;

import com.trucoclub.dto.LoginRequest;
import com.trucoclub.dto.RegistroRequest;
import com.trucoclub.seguridad.JwtService;
import com.trucoclub.service.UsuarioService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UsuarioService usuarioService;
    private final JwtService jwtService;

    public AuthController(UsuarioService usuarioService, JwtService jwtService) {
        this.usuarioService = usuarioService;
        this.jwtService = jwtService;
    }

    @PostMapping("/register")
    public ResponseEntity<String> registrarUsuario(@RequestBody RegistroRequest request) {
        String resultado = usuarioService.registrar(
                request.getUsername(),
                request.getEmail(),
                request.getPassword()
        );

        if (resultado.equals("OK")) {
            return ResponseEntity.ok("Usuario registrado con éxito");
        } else {
            return ResponseEntity.badRequest().body(resultado);
        }
    }

    /**
     * Si el usuario y la contraseña son correctos, devuelve {"token": "...", "username": "...", "rol": "..."}.
     * El front guarda el token y lo manda en cada pedido ("Authorization: Bearer ...").
     */
    @PostMapping("/login")
    public ResponseEntity<?> loginUsuario(@RequestBody LoginRequest request) {
        String resultado = usuarioService.login(request.getUsername(), request.getPassword());
        if (resultado.equals("Login exitoso")) {
            // Usamos el nombre como está guardado (si escribió "JOACO" y es "joaco", queda "joaco")
            var u = usuarioService.buscar(request.getUsername()).orElseThrow();
            return ResponseEntity.ok(Map.of(
                    "token", jwtService.crear(u.getUsername(), u.getId()),
                    "username", u.getUsername(),
                    "rol", u.getRol().name()));
        }
        return ResponseEntity.status(401).body(resultado);
    }
}
