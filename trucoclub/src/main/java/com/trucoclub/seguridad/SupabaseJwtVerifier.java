package com.trucoclub.seguridad;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPublicKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Verifica los tokens de sesión que da Supabase Auth (el "access token" que el front obtiene al
 * iniciar sesión con supabase-js) y devuelve el id del usuario (auth.users.id).
 *
 * Comprueba: firma, emisor (iss = https://PROYECTO.supabase.co/auth/v1), audiencia "authenticated",
 * rol "authenticated" y vencimiento.
 *
 * Firmas aceptadas:
 *  - ES256 / RS256 (claves asimétricas de Supabase): la clave pública se baja del JWKS
 *    (https://PROYECTO.supabase.co/auth/v1/.well-known/jwks.json) y se guarda en memoria.
 *  - HS256 (clave "legacy"): solo si configurás SUPABASE_JWT_SECRET. Si no, se rechaza.
 * Cualquier otro algoritmo (incluido "none") se rechaza siempre.
 */
@Component
public class SupabaseJwtVerifier {

    private static final Duration TOLERANCIA_RELOJ = Duration.ofSeconds(30);
    private static final Duration ESPERA_ENTRE_DESCARGAS = Duration.ofSeconds(60);

    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    private final String emisor;
    private final URI jwksUri;
    private final byte[] secretoHs256;

    /** kid -> clave pública. */
    private final Map<String, PublicKey> claves = new ConcurrentHashMap<>();
    private volatile Instant ultimaDescarga = Instant.EPOCH;

    @Autowired
    public SupabaseJwtVerifier(@Value("${trucoclub.supabase.url}") String urlProyecto,
                               @Value("${trucoclub.supabase.jwt-secret:}") String secretoLegacy) {
        String base = urlProyecto.endsWith("/") ? urlProyecto.substring(0, urlProyecto.length() - 1) : urlProyecto;
        this.emisor = base + "/auth/v1";
        this.jwksUri = URI.create(emisor + "/.well-known/jwks.json");
        this.secretoHs256 = secretoLegacy == null || secretoLegacy.isBlank()
                ? null : secretoLegacy.getBytes(StandardCharsets.UTF_8);
    }

    /** Para pruebas: claves cargadas a mano en vez de bajarlas de internet. */
    SupabaseJwtVerifier(String urlProyecto, String secretoLegacy, String jwksJson) {
        this(urlProyecto, secretoLegacy);
        cargarJwks(jwksJson);
        ultimaDescarga = Instant.now().plus(Duration.ofDays(3650)); // nunca intenta bajar
    }

    /** Lo que nos sirve del token: el id del usuario de Supabase y su email. */
    public record Datos(UUID id, String email) {
    }

    /** El id del usuario de Supabase si el token es válido; vacío en cualquier otro caso. */
    public Optional<UUID> verificar(String token) {
        return verificarDatos(token).map(Datos::id);
    }

    /** Id y email del usuario si el token es válido; vacío en cualquier otro caso. */
    public Optional<Datos> verificarDatos(String token) {
        try {
            if (token == null) return Optional.empty();
            String[] partes = token.split("\\.");
            if (partes.length != 3) return Optional.empty();

            JsonNode header = json.readTree(decodificar(partes[0]));
            String alg = header.path("alg").asText("");
            String kid = header.path("kid").asText("");
            byte[] firmado = (partes[0] + "." + partes[1]).getBytes(StandardCharsets.US_ASCII);
            byte[] firma = decodificar(partes[2]);

            boolean firmaOk = switch (alg) {
                case "ES256" -> verificarAsimetrica("SHA256withECDSAinP1363Format", "EC", kid, firmado, firma);
                case "RS256" -> verificarAsimetrica("SHA256withRSA", "RSA", kid, firmado, firma);
                case "HS256" -> verificarHs256(firmado, firma);
                default -> false; // "none" y cualquier otro: afuera
            };
            if (!firmaOk) return Optional.empty();

            JsonNode datos = json.readTree(decodificar(partes[1]));
            if (!emisor.equals(datos.path("iss").asText())) return Optional.empty();
            if (!tieneAudiencia(datos.path("aud"))) return Optional.empty();
            if (!"authenticated".equals(datos.path("role").asText())) return Optional.empty();
            long ahora = Instant.now().getEpochSecond();
            if (!datos.hasNonNull("exp") || datos.get("exp").asLong() + TOLERANCIA_RELOJ.toSeconds() < ahora) {
                return Optional.empty(); // vencido
            }
            String email = datos.hasNonNull("email") ? datos.get("email").asText() : null;
            return Optional.of(new Datos(UUID.fromString(datos.path("sub").asText()), email));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    // ------------------------------------------------------------------ firmas

    private boolean verificarAsimetrica(String algoritmo, String tipoClave, String kid, byte[] firmado, byte[] firma)
            throws Exception {
        PublicKey clave = buscarClave(kid);
        if (clave == null || !tipoClave.equals(clave.getAlgorithm())) return false;
        if ("EC".equals(tipoClave) && firma.length != 64) return false;
        Signature verificador = Signature.getInstance(algoritmo);
        verificador.initVerify(clave);
        verificador.update(firmado);
        return verificador.verify(firma);
    }

    private boolean verificarHs256(byte[] firmado, byte[] firma) throws Exception {
        if (secretoHs256 == null) {
            System.out.println("[TrucoClub] Llegó un token HS256 de Supabase y no está configurado SUPABASE_JWT_SECRET");
            return false;
        }
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secretoHs256, "HmacSHA256"));
        return MessageDigest.isEqual(mac.doFinal(firmado), firma); // comparación en tiempo constante
    }

    /** Busca la clave por kid; si no la conoce, vuelve a bajar el JWKS (como mucho una vez por minuto). */
    private PublicKey buscarClave(String kid) {
        PublicKey clave = claves.get(kid);
        if (clave != null) return clave;
        synchronized (this) {
            clave = claves.get(kid);
            if (clave != null) return clave;
            if (Instant.now().isBefore(ultimaDescarga.plus(ESPERA_ENTRE_DESCARGAS))) return null;
            ultimaDescarga = Instant.now();
            try {
                HttpResponse<String> res = http.send(
                        HttpRequest.newBuilder(jwksUri).timeout(Duration.ofSeconds(5)).GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() == 200) cargarJwks(res.body());
                else System.out.println("[TrucoClub] No se pudo bajar el JWKS de Supabase: HTTP " + res.statusCode());
            } catch (Exception e) {
                System.out.println("[TrucoClub] No se pudo bajar el JWKS de Supabase: " + e.getMessage());
            }
            return claves.get(kid);
        }
    }

    private void cargarJwks(String jwksJson) {
        try {
            for (JsonNode k : json.readTree(jwksJson).path("keys")) {
                String kid = k.path("kid").asText("");
                String kty = k.path("kty").asText("");
                if ("EC".equals(kty) && "P-256".equals(k.path("crv").asText())) {
                    AlgorithmParameters p = AlgorithmParameters.getInstance("EC");
                    p.init(new ECGenParameterSpec("secp256r1"));
                    ECPoint punto = new ECPoint(entero(k.path("x").asText()), entero(k.path("y").asText()));
                    claves.put(kid, KeyFactory.getInstance("EC")
                            .generatePublic(new ECPublicKeySpec(punto, p.getParameterSpec(ECParameterSpec.class))));
                } else if ("RSA".equals(kty)) {
                    claves.put(kid, KeyFactory.getInstance("RSA")
                            .generatePublic(new RSAPublicKeySpec(entero(k.path("n").asText()), entero(k.path("e").asText()))));
                }
            }
        } catch (Exception e) {
            System.out.println("[TrucoClub] JWKS de Supabase con formato inesperado: " + e.getMessage());
        }
    }

    // ------------------------------------------------------------------ ayudas

    private static boolean tieneAudiencia(JsonNode aud) {
        if (aud.isTextual()) return "authenticated".equals(aud.asText());
        if (aud.isArray()) for (JsonNode a : aud) if ("authenticated".equals(a.asText())) return true;
        return false;
    }

    private static byte[] decodificar(String base64url) {
        return Base64.getUrlDecoder().decode(base64url);
    }

    private static BigInteger entero(String base64url) {
        return new BigInteger(1, decodificar(base64url));
    }
}
