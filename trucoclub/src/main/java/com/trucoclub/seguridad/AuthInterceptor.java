package com.trucoclub.seguridad;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Revisa el token de Supabase en cada pedido protegido. Si es válido, deja el nombre del usuario en
 * request.getAttribute("usuario") para que lo usen los controllers. Si no, responde 401
 * (sesión inválida o vencida) o 403 (cuenta suspendida, con el motivo).
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

        SesionService.Resultado r = sesionService.revisar(request.getHeader("Authorization"));
        if (!r.valido()) {
            response.setStatus(r.status());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"" + r.mensaje().replace("\\", "\\\\").replace("\"", "\\\"") + "\"}");
            return false;
        }
        request.setAttribute(ATRIBUTO_USUARIO, r.usuario());
        return true;
    }
}
