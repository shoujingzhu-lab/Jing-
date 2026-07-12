import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Input, Space, Tooltip, Tag, Tree, Collapse, message, Tabs } from 'antd';
import {
  SaveOutlined, UndoOutlined, RedoOutlined, ArrowLeftOutlined, BugOutlined,
  PlayCircleOutlined, CheckCircleOutlined, FileTextOutlined, ApiOutlined,
  CodeOutlined, CaretRightOutlined, PauseOutlined, StepForwardOutlined,
} from '@ant-design/icons';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

const DEFAULT_CODE = `# 策略名称: 均线交叉策略
# 描述: 当快线向上穿越慢线时做多，向下穿越时平多
# 交易对: BTC/USDT
# K线周期: 1h

from quant_sdk import Strategy, OrderType, Side

class EMACrossStrategy(Strategy):
    """EMA 快慢线交叉策略"""

    def __init__(self):
        self.fast_period = 20
        self.slow_period = 50
        self.order_amount = 0.1  # BTC

    def on_bar(self, klines):
        # 计算 EMA
        fast_ema = self.ema(klines, self.fast_period)
        slow_ema = self.ema(klines, self.slow_period)

        # 交叉信号
        if self.cross_above(fast_ema, slow_ema):
            self.order(Side.BUY, OrderType.MARKET, self.order_amount)
        elif self.cross_below(fast_ema, slow_ema):
            self.close_position()

    def ema(self, data, period):
        """计算指数移动平均线"""
        alpha = 2 / (period + 1)
        result = [data[0].close]
        for i in range(1, len(data)):
            result.append(alpha * data[i].close + (1 - alpha) * result[-1])
        return result

    def cross_above(self, a, b):
        """判断 a 是否向上穿越 b"""
        return a[-2] <= b[-2] and a[-1] > b[-1]

    def cross_below(self, a, b):
        """判断 a 是否向下穿越 b"""
        return a[-2] >= b[-2] and a[-1] < b[-1]

# 策略入口
strategy = EMACrossStrategy()
`;

const FILE_TREE = [
  { title: '📁 策略文件', key: 'files', children: [
    { title: '📄 main.py', key: 'main', isLeaf: true },
    { title: '📄 indicators.py', key: 'indicators', isLeaf: true },
    { title: '📄 utils.py', key: 'utils', isLeaf: true },
  ]},
];

const API_DOCS = [
  { title: '📚 Strategy 基类', key: 'strategy', children: [
    { title: 'on_bar(klines)', key: 'on_bar', isLeaf: true },
    { title: 'on_tick(ticker)', key: 'on_tick', isLeaf: true },
    { title: 'order(side, type, amount)', key: 'order', isLeaf: true },
    { title: 'close_position()', key: 'close', isLeaf: true },
    { title: 'set_stop_loss(price)', key: 'sl', isLeaf: true },
    { title: 'set_take_profit(price)', key: 'tp', isLeaf: true },
    { title: 'get_position()', key: 'pos', isLeaf: true },
    { title: 'get_balance()', key: 'bal', isLeaf: true },
    { title: 'sleep(seconds)', key: 'sleep', isLeaf: true },
    { title: 'log(message)', key: 'log', isLeaf: true },
  ]},
  { title: '📈 技术指标', key: 'indicators', children: [
    { title: 'ma(data, period)', key: 'ma', isLeaf: true },
    { title: 'ema(data, period)', key: 'ema', isLeaf: true },
    { title: 'rsi(data, period)', key: 'rsi', isLeaf: true },
    { title: 'macd(data)', key: 'macd', isLeaf: true },
    { title: 'bollinger(data)', key: 'boll', isLeaf: true },
    { title: 'atr(data, period)', key: 'atr', isLeaf: true },
  ]},
];

export default function CodeStrategyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  const [strategyName, setStrategyName] = useState(isEditing ? '均线交叉策略' : '未命名策略');
  const [code, setCode] = useState(DEFAULT_CODE);
  const [saving, setSaving] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [leftPanel, setLeftPanel] = useState<'files' | 'api'>('files');
  const [rightPanel, setRightPanel] = useState<'none' | 'api'>('none');
  const [showDebug, setShowDebug] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState('main');
  const [breakpoints] = useState<number[]>([15, 22]);

  const handleEditorMount: OnMount = (editorInstance: editor.IStandaloneCodeEditor) => {
    // 断点装饰
    breakpoints.forEach((line) => {
      editorInstance.deltaDecorations([], [{
        range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
        options: { isWholeLine: true, className: 'breakpoint-line', glyphMarginClassName: 'breakpoint-glyph' },
      }]);
    });
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setUnsaved(false);
      message.success('策略已保存');
    }, 600);
  };

  const handleRunCheck = () => {
    setOutput(['🔍 语法检查中...', '✅ 语法检查通过', '✅ API 调用验证通过', '⚠ 建议: 添加止损逻辑']);
  };

  const handleRunBacktest = () => {
    setShowDebug(true);
    setOutput(['🚀 回测启动中...', '加载历史数据: BTC/USDT 1h', '回测进度: 25%...', '回测进度: 50%...']);
  };

  return (
    <div style={{ height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', borderRadius: '8px 8px 0 0' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/strategy')} type="text" />
          <Input value={strategyName} onChange={(e) => { setStrategyName(e.target.value); setUnsaved(true); }}
            style={{ width: 200, border: 'none', fontWeight: 600, fontSize: 15, background: 'transparent' }} />
          {unsaved && <Tag color="warning">未保存</Tag>}
        </Space>
        <Space>
          <Button icon={<UndoOutlined />} disabled />
          <Button icon={<RedoOutlined />} disabled />
          <Button icon={<FileTextOutlined />} onClick={() => setLeftPanel(leftPanel === 'files' ? 'api' : 'files')}>文件</Button>
          <Button icon={<ApiOutlined />} onClick={() => setRightPanel(rightPanel === 'none' ? 'api' : 'none')}>API 文档</Button>
          <Button icon={<CheckCircleOutlined />} onClick={handleRunCheck}>语法检查</Button>
          <Button icon={<BugOutlined />} onClick={() => { setShowDebug(!showDebug); setDebugMode(!debugMode); }} type={debugMode ? 'primary' : 'default'}>
            {debugMode ? '调试中' : '调试'}
          </Button>
          <Tooltip title="Ctrl+S">
            <Button icon={<PlayCircleOutlined />} onClick={handleRunBacktest}>快速回测</Button>
          </Tooltip>
          <Button type="primary" icon={saving ? undefined : <SaveOutlined />} loading={saving} onClick={handleSave} disabled={!unsaved}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </Space>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel */}
        {(leftPanel === 'files' || leftPanel === 'api') && (
          <div style={{ width: 220, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', overflow: 'auto' }}>
            <Tabs size="small" activeKey={leftPanel} onChange={(k) => setLeftPanel(k as 'files' | 'api')}
              items={[
                { key: 'files', label: '文件', children: <Tree treeData={FILE_TREE} defaultExpandAll onSelect={(keys) => { if (keys[0]) setSelectedFile(String(keys[0])); }} style={{ padding: 8 }} /> },
                { key: 'api', label: 'API', children: <Tree treeData={API_DOCS} defaultExpandAll style={{ padding: 8 }} /> },
              ]} />
          </div>
        )}

        {/* Center: Code Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <Editor
              height="100%"
              defaultLanguage="python"
              theme="vs-dark"
              value={code}
              onChange={(v) => { setCode(v || ''); setUnsaved(true); }}
              onMount={handleEditorMount}
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: true },
                lineNumbers: 'on',
                glyphMargin: true,
                folding: true,
                tabSize: 4,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>

          {/* Debug & Output Panel */}
          {showDebug && (
            <div style={{ height: 200, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', display: 'flex' }}>
              {/* Debug controls */}
              <div style={{ width: 200, borderRight: '1px solid var(--border-color)', padding: 8 }}>
                <Typography.Text strong style={{ color: 'var(--text-primary)', fontSize: 12, display: 'block', marginBottom: 8 }}>调试控制</Typography.Text>
                <Space direction="vertical" size="small">
                  <Button size="small" block icon={<BugOutlined />}>继续</Button>
                  <Button size="small" block icon={<StepForwardOutlined />}>单步</Button>
                  <Button size="small" block icon={<PauseOutlined />}>跳出</Button>
                  <Button size="small" block danger>停止</Button>
                </Space>
                <div style={{ marginTop: 12 }}>
                  <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 11 }}>变量监视</Typography.Text>
                  <div style={{ background: 'var(--bg-tertiary)', borderRadius: 4, padding: 4, marginTop: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
                    fast_ema = 67230.50<br />
                    slow_ema = 67150.20<br />
                    position = long
                  </div>
                </div>
              </div>
              {/* Output log */}
              <div style={{ flex: 1, padding: 8, overflow: 'auto' }}>
                <Typography.Text strong style={{ color: 'var(--text-primary)', fontSize: 12, display: 'block', marginBottom: 4 }}>输出</Typography.Text>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                  {output.map((line, i) => (
                    <div key={i} style={{ color: line.startsWith('✅') ? 'var(--green-trade)' : line.startsWith('⚠') ? 'var(--warning)' : line.startsWith('❌') ? 'var(--red-trade)' : 'var(--text-secondary)', padding: '1px 0' }}>
                      {line}
                    </div>
                  ))}
                  {output.length === 0 && <div style={{ color: 'var(--text-secondary)' }}>点击"快速回测"或"语法检查"查看输出...</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: API Docs */}
        {rightPanel === 'api' && (
          <div style={{ width: 250, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)', overflow: 'auto', padding: 12 }}>
            <Typography.Text strong style={{ color: 'var(--text-primary)', fontSize: 13, display: 'block', marginBottom: 8 }}>API 文档</Typography.Text>
            <Collapse size="small" ghost items={[{
              key: 'order', label: '下单函数', children: (
                <div style={{ fontSize: 12 }}>
                  <pre style={{ color: 'var(--green-trade)', fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg-tertiary)', padding: 8, borderRadius: 4 }}>
{`self.order(
  side=Side.BUY,
  type=OrderType.MARKET,
  amount=0.1  # BTC
)`}</pre>
                  <div style={{ color: 'var(--text-secondary)' }}>参数:<br />side: BUY/SELL<br />type: MARKET/LIMIT<br />amount: 数量</div>
                  <Button size="small" block style={{ marginTop: 8 }}>📋 复制代码</Button>
                </div>
              ),
            }]} />
          </div>
        )}
      </div>
    </div>
  );
}
