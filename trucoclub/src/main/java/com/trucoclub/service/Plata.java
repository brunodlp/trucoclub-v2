package com.trucoclub.service;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

/** Formato de plata para los textos: $5.000 o $5.000,50. */
public final class Plata {

    private Plata() {}

    public static String formato(BigDecimal monto) {
        if (monto == null) return "$0";
        DecimalFormat f = new DecimalFormat("#,##0.##", DecimalFormatSymbols.getInstance(Locale.forLanguageTag("es-AR")));
        String texto = f.format(monto);
        // si tiene centavos, que sean siempre dos (5.000,5 -> 5.000,50)
        int coma = texto.indexOf(',');
        if (coma >= 0 && texto.length() - coma == 2) texto += "0";
        return "$" + texto;
    }
}
