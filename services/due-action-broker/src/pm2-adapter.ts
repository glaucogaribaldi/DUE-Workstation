import * as pm2 from 'pm2';

export interface Pm2ProcessStatus {
  status: string;
  pid: number | null;
  uptimeSeconds: number | null;
  restarts: number | null;
  cpuPercent: number | null;
  memoryBytes: number | null;
}

export async function describeProcess(target: string, timeoutMs: number = 2000): Promise<Pm2ProcessStatus | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pm2.disconnect();
      reject(new Error('PM2 operation timed out'));
    }, timeoutMs);

    pm2.connect((err: Error | null) => {
      if (err) {
        clearTimeout(timer);
        return reject(new Error('PM2 Connection failed'));
      }
      pm2.describe(target, (errDescribe: Error | null, processDescription: pm2.ProcessDescription[]) => {
        clearTimeout(timer);
        pm2.disconnect();

        if (errDescribe) {
          return reject(errDescribe);
        }
        if (!processDescription || processDescription.length === 0) {
          return resolve(null); // Not found
        }

        const proc = processDescription[0];
        
        let uptimeSeconds: number | null = null;
        if (proc.pm2_env && proc.pm2_env.pm_uptime) {
           uptimeSeconds = Math.floor((Date.now() - proc.pm2_env.pm_uptime) / 1000);
        }

        resolve({
          status: proc.pm2_env?.status || 'unknown',
          pid: proc.pid || null,
          uptimeSeconds,
          restarts: proc.pm2_env?.restart_time ?? null,
          cpuPercent: proc.monit?.cpu ?? null,
          memoryBytes: proc.monit?.memory ?? null
        });
      });
    });
  });
}
