package com.trucoclub.config;

import com.trucoclub.entity.Rol;
import com.trucoclub.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Al arrancar el servidor, les da rol ADMIN a los usuarios de la propiedad trucoclub.admins
 * (separados por coma). Así el primer admin se crea sin tocar la base a mano.
 * Solo agrega: para sacarle el admin a alguien, cambiá su rol a JUGADOR en la tabla usuarios.
 */
@Component
public class AdminInicial implements ApplicationRunner {

    private final UsuarioRepository usuarioRepository;
    private final String admins;

    public AdminInicial(UsuarioRepository usuarioRepository, @Value("${trucoclub.admins:}") String admins) {
        this.usuarioRepository = usuarioRepository;
        this.admins = admins;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (String nombre : admins.split(",")) {
            String username = nombre.trim();
            if (username.isEmpty()) continue;
            usuarioRepository.findByUsername(username).ifPresentOrElse(u -> {
                if (!u.esAdmin()) {
                    u.setRol(Rol.ADMIN);
                    usuarioRepository.save(u);
                    System.out.println("[TrucoClub] " + username + " ahora es ADMIN");
                }
            }, () -> System.out.println("[TrucoClub] No existe el usuario '" + username + "' para hacerlo admin. Registralo y reiniciá."));
        }
    }
}
