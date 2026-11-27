package com.trucoclub.seguridad;

import com.trucoclub.entity.Usuario;
import com.trucoclub.repository.UsuarioRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Corre después de AuthInterceptor en /api/admin/**. Mira el rol en la base de datos en cada
 * pedido (no en el token), así si le sacás el admin a alguien, deja de poder entrar al instante.
 */
@Component
public class AdminInterceptor implements HandlerInterceptor {

    private final UsuarioRepository usuarioRepository;

    public AdminInterceptor(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;

        Object usuario = request.getAttribute(AuthInterceptor.ATRIBUTO_USUARIO);
        boolean esAdmin = usuario != null && usuarioRepository.findByUsername(usuario.toString())
                .map(Usuario::esAdmin).orElse(false);
        if (!esAdmin) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"No tenés permiso para entrar acá.\"}");
            return false;
        }
        return true;
    }
}
