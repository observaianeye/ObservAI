import { Injectable, Logger } from '@nestjs/common'
import { promises as fs } from 'fs'
import path from 'path'
import type { CameraMetricsDTO } from '@observai/types'

const DEFAULT_METRICS_PATH = path.resolve(process.cwd(), 'data/camera/latest_metrics.json')

@Injectable()
export class CameraService {
  private readonly logger = new Logger(CameraService.name)
  private readonly metricsPath = process.env.CAMERA_METRICS_PATH ?? DEFAULT_METRICS_PATH

  async readMetrics(): Promise<CameraMetricsDTO | null> {
    try {
      const content = await fs.readFile(this.metricsPath, 'utf-8')
      return JSON.parse(content) as CameraMetricsDTO
    } catch (error) {
      this.logger.warn(
        `Camera metrics file not available at ${this.metricsPath}: ${(error as Error).message}`,
      )
      return null
    }
  }
}
