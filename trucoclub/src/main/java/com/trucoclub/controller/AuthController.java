package com.trucoclub.controller;

import com.trucoclub.dto.LoginRequest;
import com.trucoclub.dto.RegistroRequest;
import com.trucoclub.service.UsuarioService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UsuarioService usuarioService;

    public AuthController(UsuarioService usuarioService) {
        this.usuarioService = usuarioService;
    }

    @PostMapping("/register")
    public ResponseEntity registrarUsuario(@RequestBody RegistroRequest request) {
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

    @PostMapping("/login")
    public ResponseEntity<String> loginUsuario(@RequestBody LoginRequest request) {
        String resultado = usuarioService.login(request.getUsername(), request.getPassword());
        if (resultado.equals("Login exitoso")) {
            return ResponseEntity.ok(resultado);
        }else{
            return ResponseEntity.status(401).body(resultado);
        }

    }

}