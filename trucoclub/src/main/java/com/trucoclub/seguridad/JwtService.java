package com.trucoclub.seguridad;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Crea y valida los tokens de sesión (formato JWT, firmados con HMAC-SHA256).
 *
 * El token tiene adentro el nombre de usuario y la fecha de vencimiento, y va firmado con una
 * clave secreta que solo conoce el servidor: si alguien lo modifica, la firma deja de coincidir.
 * Se usa javax.crypto (viene con Java), así que no hace falta agregar dependencias.
 */
@Service
public class JwtService {

    private static final Pattern SUB = Pattern.compile("\"sub\":\"((?:[^\"\\\\]|\\\\.)*)\"");
    private static final Pattern EXP = Pattern.compile("\"exp\":(\\d+)");
    private static final Pattern UID = Pattern.compile("\"uid\":(\\d+)");
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();
    private static final String HEADER = B64.encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));

    private final byte[] clave;
    private final long duracionSegundos;

    public JwtService(@Value("${trucoclub.jwt.secret}") String secreto,
                      @Value("${trucoclub.jwt.dias:7}") int dias) {
        if (secreto == null || secreto.length() < 32) {
            throw new IllegalStateException("trucoclub.jwt.secret tiene que tener al menos 32 caracteres");
        }
        this.clave = secreto.getBytes(StandardCharsets.UTF_8);
        this.duracionSegundos = dias * 86400L;
    }

    /** Lo que trae un token válido: el nombre y el id del usuario. */
    public record Sesion(String username, long id) {
    }

    /**
     * Token nuevo para el usuario, válido por los días configurados. Lleva el id además del nombre:
     * si el usuario se cambia el nombre, los tokens viejos dejan de servir (ver SesionService).
     */
    public String crear(String username, long id) {
        long vence = Instant.now().getEpochSecond() + duracionSegundos;
        String payload = "{\"sub\":\"" + escapar(username) + "\",\"uid\":" + id + ",\"exp\":" + vence + "}";
        String cuerpo = HEADER + "." + B64.encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return cuerpo + "." + firmar(cuerpo);
    }

    /** Devuelve nombre e id si el token es válido y no venció; vacío en cualquier otro caso. */
    public Optional<Sesion> validar(String token) {
        try {
            if (token == null) return Optional.empty();
            String[] partes = token.trim().split("\\.");
            if (partes.length != 3 || !HEADER.equals(partes[0])) return Optional.empty();

            String esperada = firmar(partes[0] + "." + partes[1]);
            // comparación de tiempo constante (para no dar pistas sobre la firma)
            if (!MessageDigest.isEqual(esperada.getBytes(StandardCharsets.UTF_8), partes[2].getBytes(StandardCharsets.UTF_8))) {
                return Optional.empty();
            }

            String payload = new String(B64D.decode(partes[1]), StandardCharsets.UTF_8);
            Matcher exp = EXP.matcher(payload);
            Matcher sub = SUB.matcher(payload);
            Matcher uid = UID.matcher(payload);
            if (!exp.find() || !sub.find() || !uid.find()) return Optional.empty(); // los tokens viejos sin id no sirven
            if (Long.parseLong(exp.group(1)) < Instant.now().getEpochSecond()) return Optional.empty(); // vencido
            return Optional.of(new Sesion(desescapar(sub.group(1)), Long.parseLong(uid.group(1))));
        } catch (RuntimeException e) {
            return Optional.empty();
        }
    }

    /** Saca el token de un encabezado "Authorization: Bearer xxx". */
    public Optional<Sesion> validarEncabezado(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) return Optional.empty();
        return validar(authorization.substring(7));
    }

    private String firmar(String datos) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(clave, "HmacSHA256"));
            return B64.encodeToString(mac.doFinal(datos.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo firmar el token", e);
        }
    }

    private static String escapar(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static String desescapar(String s) {
        return s.replace("\\\"", "\"").replace("\\\\", "\\");
    }
}
