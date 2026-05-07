declare module 'react-plotly.js' {
  import React from 'react';
  
  interface PlotData {
    x?: any[];
    y?: any[];
    z?: any[][];
    type?: string;
    mode?: string;
    name?: string;
    marker?: any;
    boxmean?: string;
    [key: string]: any;
  }

  interface Layout {
    title?: string;
    xaxis?: any;
    yaxis?: any;
    height?: number;
    [key: string]: any;
  }

  interface Config {
    responsive?: boolean;
    displayModeBar?: boolean;
    [key: string]: any;
  }

  interface PlotProps {
    data: PlotData[];
    layout: Layout;
    config?: Config;
    style?: React.CSSProperties;
  }

  export default React.FC<PlotProps>;
}
