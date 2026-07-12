import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Button, Space, Select, DatePicker, Tag, Progress, message, Form, InputNumber } from 'antd';
import { DownloadOutlined, ReloadOutlined, PlusOutlined, CopyOutlined } from '@ant-design/icons';
import { EXCHANGES, KLINE_PERIODS } from '@/lib/constants';
import EmptyState from '@/components/ui/EmptyState';
import StatusTag from '@/components/ui/StatusTag';
import type { DownloadTask, DataDownloadRequest } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

const MOCK_TASKS: DownloadTask[] = [
  { id: 'dl-001', request: { exchange: 'binance', symbols: ['BTC/USDT'], dataType: 'kline', period: '1h', startDate: '2025-01-01', endDate: '2025-12-31', format: 'csv' }, status: 'completed', progress: 100, downloadUrl: '#', createdAt: '2026-06-07T08:00:00Z', completedAt: '2026-06-07T08:05:00Z' },
  { id: 'dl-002', request: { exchange: 'okx', symbols: ['ETH/USDT', 'SOL/USDT'], dataType: 'orderbook', startDate: '2025-06-01', endDate: '2026-06-01', format: 'parquet' }, status: 'generating', progress: 62, createdAt: '2026-06-07T10:00:00Z' },
  { id: 'dl-003', request: { exchange: 'bybit', symbols: ['BNB/USDT'], dataType: 'trade', startDate: '2025-01-01', endDate: '2025-06-30', format: 'json' }, status: 'pending', progress: 0, createdAt: '2026-06-07T10:30:00Z' },
];

export default function DataCenterPage() {
  const [tasks, setTasks] = useState<DownloadTask[]>(MOCK_TASKS);
  const [loading, setLoading] = useState(false);

  const [exchange, setExchange] = useState<string>('binance');
  const [symbols, setSymbols] = useState<string[]>(['BTC/USDT']);
  const [dataType, setDataType] = useState<string>('kline');
  const [period, setPeriod] = useState<string>('1h');
  const [format, setFormat] = useState<string>('csv');
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');

  const handleDownload = () => {
    const newTask: DownloadTask = {
      id: `dl-${Date.now()}`, request: {
        exchange: exchange as 'binance', symbols,
        dataType: dataType as 'kline', period: dataType === 'kline' ? (period as '1h') : undefined,
        startDate, endDate, format: format as 'csv',
      },
      status: 'pending', progress: 0,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
    message.success('下载任务已创建');
  };

  const taskCols: ColumnsType<DownloadTask> = [
    { title: '任务ID', dataIndex: 'id', width: 110, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span> },
    { title: '交易所', render: (_: unknown, r: DownloadTask) => <Tag>{r.request.exchange}</Tag>, width: 90 },
    { title: '交易对', render: (_: unknown, r: DownloadTask) => r.request.symbols.join(', '), width: 160 },
    { title: '数据类型', render: (_: unknown, r: DownloadTask) => <Tag>{r.request.dataType}</Tag>, width: 100 },
    { title: '周期', render: (_: unknown, r: DownloadTask) => r.request.period || '-', width: 80 },
    { title: '格式', render: (_: unknown, r: DownloadTask) => <Tag color="blue">{r.request.format}</Tag>, width: 80 },
    { title: '区间', render: (_: unknown, r: DownloadTask) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.request.startDate} ~ {r.request.endDate}</span>, width: 200 },
    { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag status={v} statusMap={{ pending: { label: '等待中', color: 'default' }, generating: { label: '生成中', color: 'processing' }, completed: { label: '已完成', color: 'success' }, failed: { label: '失败', color: 'error' } } as Record<string, { label: string; color: string }>} /> },
    { title: '进度', dataIndex: 'progress', width: 120, render: (v: number) => <Progress percent={v} size="small" strokeColor={v === 100 ? '#26A69A' : '#F0B90B'} /> },
    { title: '操作', width: 60, render: (_: unknown, r: DownloadTask) => r.status === 'completed' && r.downloadUrl ? <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => message.info('下载功能将在后续实现')}>下载</Button> : null },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ color: 'var(--text-primary)', marginBottom: 20 }}>数据中心</Typography.Title>

      {/* 数据下载表单 */}
      <Card title="数据下载" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginBottom: 16 }}>
        <Row gutter={[16, 12]}>
          <Col xs={24} sm={12} md={6}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 13 }}>交易所</div>
            <Select value={exchange} onChange={setExchange} style={{ width: '100%' }} options={EXCHANGES.map((e) => ({ value: e.key, label: `${e.icon} ${e.label}` }))} />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 13 }}>交易对</div>
            <Select mode="tags" value={symbols} onChange={setSymbols} style={{ width: '100%' }} placeholder="输入交易对"
              options={['BTC/USDT','ETH/USDT','SOL/USDT','BNB/USDT','XRP/USDT','DOGE/USDT','AVAX/USDT','LINK/USDT'].map((s) => ({ value: s, label: s }))} />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 13 }}>数据类型</div>
            <Select value={dataType} onChange={setDataType} style={{ width: '100%' }} options={[
              { value: 'kline', label: 'K线' }, { value: 'orderbook', label: '订单簿' }, { value: 'trade', label: '成交' }, { value: 'funding_rate', label: '资金费率' },
            ]} />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 13 }}>周期</div>
            <Select value={period} onChange={setPeriod} style={{ width: '100%' }} disabled={dataType !== 'kline'} options={KLINE_PERIODS.map((k) => ({ value: k.key, label: k.label }))} />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 13 }}>格式</div>
            <Select value={format} onChange={setFormat} style={{ width: '100%' }} options={[
              { value: 'csv', label: 'CSV' }, { value: 'json', label: 'JSON' }, { value: 'parquet', label: 'Parquet' },
            ]} />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 13 }}>开始日期</div>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)' }} />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 13 }}>结束日期</div>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)' }} />
          </Col>
          <Col xs={24} style={{ marginTop: 8 }}>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>提交下载任务</Button>
          </Col>
        </Row>
      </Card>

      {/* 下载任务列表 */}
      <Card title={`下载任务 (${tasks.length})`} style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        {tasks.length === 0 ? (
          <EmptyState title="暂无下载任务" description="使用上方表单创建数据下载请求" />
        ) : (
          <Table columns={taskCols} dataSource={tasks} rowKey="id" loading={loading} pagination={false} size="middle" scroll={{ x: 1200 }} />
        )}
      </Card>
    </div>
  );
}
