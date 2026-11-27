package com.trucoclub;

import com.trucoclub.seguridad.SesionService;
import com.trucoclub.seguridad.UsuarioPrincipal;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final SesionService sesionService;

    public WebSocketConfig(SesionService sesionService) {
        this.sesionService = sesionService;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Broker simple para enviar mensajes a los clientes
        config.enableSimpleBroker("/topic", "/queue");
        // Prefijo para los mensajes que vienen desde el cliente (React)
        config.setApplicationDestinationPrefixes("/app");
        // Prefijo de los canales personales: cada jugador escucha /user/queue/partida y solo recibe lo suyo
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-truco")
                .setAllowedOriginPatterns("https://trucoclub-rose.vercel.app", "http://localhost:5173")
                .withSockJS();
    }

    /**
     * Al conectarse, el navegador manda el token en el encabezado "Authorization" del CONNECT.
     * Si es válido, la conexión queda a nombre de ese usuario; si no, se rechaza.
     * Después, las jugadas usan ese usuario (no lo que mande el navegador en el mensaje).
     */
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String usuario = sesionService.usuarioDe(accessor.getFirstNativeHeader("Authorization"))
                            .orElseThrow(() -> new MessagingException("Sesión inválida o vencida"));
                    accessor.setUser(new UsuarioPrincipal(usuario));
                }
                return message;
            }
        });
    }
}
