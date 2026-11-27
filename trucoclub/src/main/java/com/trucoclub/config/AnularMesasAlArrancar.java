package com.trucoclub.config;

import com.trucoclub.service.ApuestaService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Las partidas viven en memoria: si el servidor se reinicia, se pierden. Para que nadie pierda su
 * plata, al arrancar se anulan las mesas que quedaron abiertas o a medio jugar y se devuelven las apuestas.
 */
@Component
public class AnularMesasAlArrancar implements ApplicationRunner {

    private final ApuestaService apuestaService;

    public AnularMesasAlArrancar(ApuestaService apuestaService) {
        this.apuestaService = apuestaService;
    }

    @Override
    public void run(ApplicationArguments args) {
        int anuladas = apuestaService.anularActivas();
        if (anuladas > 0) {
            System.out.println("[TrucoClub] Se anularon " + anuladas + " mesas que quedaron abiertas y se devolvieron las apuestas");
        }
    }
}
