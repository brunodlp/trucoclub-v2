package com.trucoclub.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Prende las tareas automáticas (@Scheduled), por ejemplo vencer los depósitos que no llegaron a tiempo. */
@Configuration
@EnableScheduling
public class Tareas {
}
