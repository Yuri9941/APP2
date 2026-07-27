import {
  entity,
  authenticated,
  uuid,
  text,
  int,
  decimal,
  date,
} from '@microsoft/rayfin-core';

/**
 * Строки KPI (раньше ZHGOK_2026_test).
 * value_source = 'APP' — ручное значение; иначе автоматическое.
 */
@entity()
@authenticated('*')
export class App2 {
  @uuid()
  id!: string;

  @text({ max: 5 })
  BU!: string;

  @int()
  KPI_code!: number;

  @date()
  shift_date!: Date;

  @int()
  shift_n!: number;

  @date({ optional: true })
  ShiftFrom?: Date;

  @date({ optional: true })
  ShiftTo?: Date;

  /** 'APP' = ручной ввод; иначе источник авто */
  @text({ max: 20, optional: true })
  value_source?: string;

  @text({ max: 20, optional: true })
  SCENARIO?: string;

  @decimal({ optional: true })
  kpi_value?: number;

  /** Дата/время внесения или изменения ручного значения (value_source=APP) */
  @date({ optional: true })
  TMSTMP?: Date;

  /** Кто внёс/изменил ручное значение (email / UPN из Fabric SSO). Не USER — зарезервировано в SQL. */
  @text({ max: 320, optional: true })
  changed_by?: string;
}
