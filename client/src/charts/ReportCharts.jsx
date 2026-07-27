import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  buildScenarioMonthMatrix,
  buildMonthCounts,
  buildMirsCounts,
  buildTop3Manual,
} from './chartData';

const COLORS = ['#6eb5ff', '#7dcea0', '#f5b041', '#af7ac5', '#ec7063', '#5dade2', '#58d68d'];

const baseText = {
  color: '#ddd',
  fontSize: 10,
};

function ChartCard({ title, option }) {
  return (
    <div className="chart-card">
      <div className="chart-card-title">{title}</div>
      <ReactECharts
        option={option}
        style={{ height: 160, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}

export default function ReportCharts({ rows }) {
  const matrixOpt = useMemo(() => {
    const { months, scenarios, data } = buildScenarioMonthMatrix(rows);
    const max = data.reduce((m, d) => Math.max(m, d[2]), 0) || 1;
    return {
      tooltip: {
        position: 'top',
        formatter: (p) =>
          `${scenarios[p.data[1]]} × ${months[p.data[0]]}: <b>${p.data[2]}</b>`,
      },
      grid: { top: 8, right: 8, bottom: 28, left: 48 },
      xAxis: {
        type: 'category',
        data: months,
        splitArea: { show: true },
        axisLabel: { ...baseText, rotate: months.length > 4 ? 35 : 0 },
      },
      yAxis: {
        type: 'category',
        data: scenarios,
        axisLabel: baseText,
        splitArea: { show: true },
      },
      visualMap: {
        min: 0,
        max,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 8,
        itemHeight: 60,
        textStyle: baseText,
        inRange: { color: ['#3a3a3a', '#6eb5ff'] },
        show: months.length > 0,
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: { show: true, color: '#fff', fontSize: 9 },
          emphasis: { itemStyle: { shadowBlur: 4 } },
        },
      ],
    };
  }, [rows]);

  const monthBarOpt = useMemo(() => {
    const { months, values } = buildMonthCounts(rows);
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { top: 8, right: 8, bottom: 28, left: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: { ...baseText, rotate: months.length > 4 ? 35 : 0 },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: baseText,
        splitLine: { lineStyle: { color: '#555' } },
      },
      series: [
        {
          type: 'bar',
          data: values,
          itemStyle: { color: '#7dcea0' },
          label: { show: true, position: 'top', color: '#ddd', fontSize: 10 },
        },
      ],
    };
  }, [rows]);

  const pieOpt = useMemo(() => {
    const data = buildMirsCounts(rows);
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 0,
        top: 'middle',
        textStyle: baseText,
        pageTextStyle: baseText,
      },
      series: [
        {
          type: 'pie',
          radius: ['28%', '58%'],
          center: ['35%', '50%'],
          data,
          label: { show: false },
          color: COLORS,
        },
      ],
    };
  }, [rows]);

  const top3Opt = useMemo(() => {
    const { labels, values } = buildTop3Manual(rows);
    const cats = labels.length ? labels : ['—'];
    const vals = values.length ? values : [0];
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { top: 8, right: 16, bottom: 8, left: 56, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: baseText,
        splitLine: { lineStyle: { color: '#555' } },
      },
      yAxis: {
        type: 'category',
        data: cats,
        axisLabel: baseText,
      },
      series: [
        {
          type: 'bar',
          data: vals,
          itemStyle: { color: '#f5b041' },
          label: { show: true, position: 'right', color: '#ddd', fontSize: 10 },
        },
      ],
    };
  }, [rows]);

  return (
    <div className="charts-row">
      <ChartCard title="Матрица: сценарии и месяцы" option={matrixOpt} />
      <ChartCard title="Распределение по месяцам" option={monthBarOpt} />
      <ChartCard title="Доля по кодам MIRS" option={pieOpt} />
      <ChartCard title="Топ-3 ручных значений" option={top3Opt} />
    </div>
  );
}
