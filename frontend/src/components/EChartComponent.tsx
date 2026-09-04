import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface EChartProps {
  option: echarts.EChartsOption;
  style?: React.CSSProperties;
  className?: string;
  loading?: boolean;
}

export const EChartComponent: React.FC<EChartProps> = ({
  option,
  style = { height: '300px', width: '100%' },
  className = '',
  loading = false,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark', {
        renderer: 'canvas',
      });
    }

    const chart = chartInstance.current;
    if (loading) {
      chart.showLoading({
        text: 'Loading analytics...',
        color: '#3b82f6',
        textColor: '#94a3b8',
        maskColor: 'rgba(11, 17, 32, 0.7)',
      });
    } else {
      chart.hideLoading();
      chart.setOption(option, true);
    }

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [option, loading]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  return <div ref={chartRef} style={style} className={className} />;
};
