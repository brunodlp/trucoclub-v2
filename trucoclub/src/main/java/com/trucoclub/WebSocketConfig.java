package com.trucoclub; // Asegurate de cambiar esto por el nombre de tu paquete real

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Habilita un broker simple para enviar mensajes a los clientes
        config.enableSimpleBroker("/topic", "/queue");
        // Prefijo para los mensajes que vienen desde el cliente (React)
        config.setApplicationDestinationPrefixes("/app");
        // Prefijo para los mensajes privados
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // El endpoint al que se va a conectar React
        registry.addEndpoint("/ws-truco")
                .setAllowedOrigins("https://trucoclub-rose.vercel.app", "http://localhost:5173") // Permite conexiones desde el localhost:5173
                .withSockJS();
    }
}