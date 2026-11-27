package com.trucoclub.seguridad;

import java.security.Principal;

/** El usuario autenticado de una conexión de WebSocket. */
public record UsuarioPrincipal(String nombre) implements Principal {
    @Override
    public String getName() {
        return nombre;
    }
}
