package com.trucoclub.seguridad;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Optional;

/**
 * Revisa el token en cada pedido protegido. Si es válido, deja el nombre del usuario en
 * request.getAttribute("usuario") para que lo usen los controllers. Si no, responde 401.
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    public static final String ATRIBUTO_USUARIO = "usuario";

    private final SesionService sesionService;

    public AuthInterceptor(SesionService sesionService) {
        this.sesionService = sesionService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true; // pre-chequeo de CORS del navegador

        Optional<String> usuario = sesionService.usuarioDe(request.getHeader("Authorization"));
        if (usuario.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"Tu sesión venció. Volvé a iniciar sesión.\"}");
            return false;
        }
        request.setAttribute(ATRIBUTO_USUARIO, usuario.get());
        return true;
    }
}
