package com.trucoclub.service;

import com.trucoclub.dto.Ganancias;
import com.trucoclub.dto.Ganancias.*;
import com.trucoclub.entity.EstadoMesa;
import com.trucoclub.entity.EstadoMovimiento;
import com.trucoclub.entity.MesaApuesta;
import com.trucoclub.entity.Movimiento;
import com.trucoclub.entity.TipoMovimiento;
import com.trucoclub.repository.MesaApuestaRepository;
import com.trucoclub.repository.MovimientoRepository;
import com.trucoclub.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Cuenta de la comisión que se queda el sitio (el 5% del pozo de cada partido terminado).
 * Todas las fechas son de Argentina.
 */
@Service
public class GananciasService {

    private static final int MAX_DIAS_RANGO = 366;
    private static final int MAX_PARTIDOS_LISTA = 100;
    private static final LocalDateTime INICIO = LocalDateTime.of(2000, 1, 1, 0, 0);

    private final MesaApuestaRepository mesaRepository;
    private final MovimientoRepository movimientoRepository;
    private final UsuarioRepository usuarioRepository;

    public GananciasService(MesaApuestaRepository mesaRepository, MovimientoRepository movimientoRepository,
                            UsuarioRepository usuarioRepository) {
        this.mesaRepository = mesaRepository;
        this.movimientoRepository = movimientoRepository;
        this.usuarioRepository = usuarioRepository;
    }

    /** desde/hasta inclusive. Si no vienen, los últimos 30 días. */
    @Transactional(readOnly = true)
    public Ganancias calcular(LocalDate desde, LocalDate hasta) {
        LocalDate hoy = Movimiento.ahora().toLocalDate();
        LocalDateTime manana = hoy.plusDays(1).atStartOfDay();

        LocalDate fin = hasta == null ? hoy : hasta;
        LocalDate ini = desde == null ? fin.minusDays(29) : desde;
        if (ini.isAfter(fin)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La fecha 'desde' tiene que ser anterior a 'hasta'.");
        }
        if (ChronoUnit.DAYS.between(ini, fin) >= MAX_DIAS_RANGO) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El rango puede ser de hasta un año.");
        }

        return new Ganancias(
                periodo(hoy.atStartOfDay(), manana),
                periodo(hoy.with(DayOfWeek.MONDAY).atStartOfDay(), manana),
                periodo(hoy.withDayOfMonth(1).atStartOfDay(), manana),
                periodo(INICIO, manana.plusYears(100)),
                rango(ini, fin),
                caja());
    }

    private Periodo periodo(LocalDateTime desde, LocalDateTime hasta) {
        return new Periodo(mesaRepository.sumarComision(EstadoMesa.TERMINADA, desde, hasta),
                mesaRepository.contarTerminadas(EstadoMesa.TERMINADA, desde, hasta));
    }

    private Rango rango(LocalDate ini, LocalDate fin) {
        List<MesaApuesta> mesas = mesaRepository.terminadasEntre(EstadoMesa.TERMINADA,
                ini.atStartOfDay(), fin.plusDays(1).atStartOfDay());

        // un lugar por cada día del rango, aunque no haya partidos (para que el gráfico no salte días)
        Map<LocalDate, BigDecimal[]> dias = new LinkedHashMap<>();
        for (LocalDate d = ini; !d.isAfter(fin); d = d.plusDays(1)) {
            dias.put(d, new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
        }
        BigDecimal comision = BigDecimal.ZERO;
        BigDecimal volumen = BigDecimal.ZERO;
        List<Partido> lista = new ArrayList<>();
        for (MesaApuesta m : mesas) {
            BigDecimal c = m.getComision() == null ? BigDecimal.ZERO : m.getComision();
            comision = comision.add(c);
            volumen = volumen.add(m.getMonto().multiply(BigDecimal.valueOf(2)));
            BigDecimal[] dia = dias.get(m.getTerminada().toLocalDate());
            if (dia != null) {
                dia[0] = dia[0].add(c);
                dia[1] = dia[1].add(BigDecimal.ONE);
            }
            if (lista.size() < MAX_PARTIDOS_LISTA) {
                lista.add(new Partido(m.getId(), m.getTerminada(), m.getCreador().getUsername(),
                        m.getRival() == null ? null : m.getRival().getUsername(), m.nombreGanador(),
                        m.getMonto(), m.getPremio(), c));
            }
        }
        List<Dia> porDia = new ArrayList<>();
        dias.forEach((fecha, v) -> porDia.add(new Dia(fecha, v[0], v[1].longValue())));
        return new Rango(ini, fin, comision, mesas.size(), volumen, porDia, lista);
    }

    private Caja caja() {
        BigDecimal depositos = movimientoRepository.sumar(TipoMovimiento.DEPOSITO, EstadoMovimiento.APROBADO);
        BigDecimal retiros = movimientoRepository.sumar(TipoMovimiento.RETIRO, EstadoMovimiento.APROBADO);
        BigDecimal retirosPendientes = movimientoRepository.sumar(TipoMovimiento.RETIRO, EstadoMovimiento.PENDIENTE);
        BigDecimal saldos = usuarioRepository.sumarSaldos();
        // esperando rival: puso solo el creador; jugando: pusieron los dos
        BigDecimal enMesas = mesaRepository.sumarMontos(EstadoMesa.ESPERANDO)
                .add(mesaRepository.sumarMontos(EstadoMesa.JUGANDO).multiply(BigDecimal.valueOf(2)));
        BigDecimal comisionTotal = mesaRepository.sumarComision(EstadoMesa.TERMINADA, INICIO, LocalDateTime.of(2999, 1, 1, 0, 0));

        BigDecimal enCuenta = depositos.subtract(retiros);
        BigDecimal deJugadores = saldos.add(enMesas).add(retirosPendientes);
        BigDecimal diferencia = enCuenta.subtract(deJugadores).subtract(comisionTotal);
        return new Caja(depositos, retiros, enCuenta, saldos, enMesas, retirosPendientes, deJugadores, comisionTotal, diferencia);
    }
}
