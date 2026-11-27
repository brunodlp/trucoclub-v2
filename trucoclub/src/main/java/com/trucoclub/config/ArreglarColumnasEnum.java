package com.trucoclub.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Hibernate crea las columnas de los enums (tipo, estado, rol) como ENUM de MySQL, con los valores
 * que existían en ese momento. Si después agregamos un valor nuevo (ej: APUESTA), MySQL lo rechaza
 * ("Data truncated for column 'tipo'"). Al arrancar, esto las pasa a VARCHAR, que acepta cualquier valor.
 * Corre antes que todo lo demás y si ya están bien no hace nada.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ArreglarColumnasEnum implements ApplicationRunner {

    private static final String[][] COLUMNAS = {
            {"movimientos", "tipo", "NOT NULL"},
            {"movimientos", "estado", "NOT NULL"},
            {"mesas", "estado", "NOT NULL"},
            {"usuarios", "rol", "NULL"},
    };

    private final JdbcTemplate jdbc;

    public ArreglarColumnasEnum(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (String[] c : COLUMNAS) {
            try {
                List<String> tipo = jdbc.queryForList(
                        "select data_type from information_schema.columns "
                                + "where table_schema = database() and table_name = ? and column_name = ?",
                        String.class, c[0], c[1]);
                if (!tipo.isEmpty() && "enum".equalsIgnoreCase(tipo.get(0))) {
                    jdbc.execute("ALTER TABLE " + c[0] + " MODIFY " + c[1] + " VARCHAR(20) " + c[2]);
                    System.out.println("[TrucoClub] Columna " + c[0] + "." + c[1] + " pasada a VARCHAR");
                }
            } catch (RuntimeException e) {
                System.out.println("[TrucoClub] No se pudo revisar " + c[0] + "." + c[1] + ": " + e.getMessage());
            }
        }
    }
}
