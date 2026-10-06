// On-demand ECharts registration: only the chart types and components this
// app uses end up in the bundle (instead of `import * as echarts`).
import { BarChart, GaugeChart, LineChart, PieChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendPlainComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import { connect, disconnect, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

use([
  LineChart,
  PieChart,
  GaugeChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendPlainComponent,
  DataZoomComponent,
  MarkLineComponent,
  GraphicComponent,
  CanvasRenderer,
])

export { connect, disconnect }
export type { EChartsOption } from 'echarts'
