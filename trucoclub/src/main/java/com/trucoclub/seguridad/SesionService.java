package com.trucoclub.seguridad;

import com.trucoclub.repository.UsuarioRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Valida el token y además que el usuario siga existiendo con ese nombre y no esté suspendido.
 * Si alguien se cambió el nombre, sus tokens viejos dejan de valer (y nadie que después se registre
 * con el nombre viejo puede quedar logueado como él).
 */
@Service
public class SesionService {

    private final JwtService jwtService;
    private final UsuarioRepository usuarioRepository;

    public SesionService(JwtService jwtService, UsuarioRepository usuarioRepository) {
        this.jwtService = jwtService;
        this.usuarioRepository = usuarioRepository;
    }

    /** Nombre del usuario logueado según el encabezado "Authorization: Bearer ...", o vacío si no vale. */
    public Optional<String> usuarioDe(String authorization) {
        return jwtService.validarEncabezado(authorization)
                .filter(s -> usuarioRepository.findById(s.id())
                        .map(u -> u.getUsername().equals(s.username()) && !u.estaBloqueado())
                        .orElse(false))
                .map(JwtService.Sesion::username);
    }
}
