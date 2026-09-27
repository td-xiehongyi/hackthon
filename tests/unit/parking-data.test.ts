import { describe, expect, it } from 'vitest';
import { formatParkingDuration, PARKING_PORTS } from '../../src/features/parking/parkingData';
import {
  matchParkingPort,
  PARKING_REFRESH_INTERVALS,
  parseRefreshInterval,
  refreshIntervalLabel,
} from '../../src/features/parking/ParkingPanel';

describe('二维码停车位快照', () => {
  it('保留照片顺序、完整设备号和状态数量', () => {
    expect(PARKING_PORTS).toHaveLength(10);
    expect(PARKING_PORTS.map((port) => port.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(PARKING_PORTS.map((port) => port.id)).toEqual([
      '120000032056', '120000040680', '120000040145', '120000040056', '120000040770',
      '120000040323', '120000040412', '120000039638', '120000039816', '120000041570',
    ]);
    expect(PARKING_PORTS.filter((port) => port.status === 'occupied')).toHaveLength(3);
    expect(PARKING_PORTS.every((port) => port.payload.includes(`DeviceNumber=${port.id}`))).toBe(true);
  });

  it('格式化端口详情中的剩余时间', () => {
    expect(formatParkingDuration(0)).toBe('00:00');
    expect(formatParkingDuration(28 * 60 + 46)).toBe('28:46');
    expect(formatParkingDuration(1 * 3600 + 42 * 60 + 18)).toBe('01:42:18');
  });

  it('可以用完整或短设备号匹配二维码文字', () => {
    expect(matchParkingPort('http://semiot.wasion.cn?DeviceNumber=120000032056')?.order).toBe(1);
    expect(matchParkingPort('1200000403')?.id).toBe('120000040323');
    expect(matchParkingPort('https://example.test/unknown')).toBeNull();
  });

  it('提供可控的自动刷新间隔选项', () => {
    expect(PARKING_REFRESH_INTERVALS).toEqual([0, 15, 30, 60]);
    expect(parseRefreshInterval('0')).toBe(0);
    expect(parseRefreshInterval('30')).toBe(30);
    expect(parseRefreshInterval('unexpected')).toBe(15);
    expect(refreshIntervalLabel(0)).toBe('暂停自动刷新');
    expect(refreshIntervalLabel(15)).toBe('每 15 秒');
  });
});
