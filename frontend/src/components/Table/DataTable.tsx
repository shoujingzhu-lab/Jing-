import { Table, type TableProps } from 'antd';
import type { PaginatedResponse } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface DataTableProps<T extends AnyRecord> extends Omit<TableProps<T>, 'dataSource' | 'loading' | 'pagination'> {
  data?: PaginatedResponse<T> | T[];
  loading?: boolean;
  pagination?: boolean | TableProps<T>['pagination'];
  /** 是否虚拟滚动（大数据量） */
  virtualScroll?: boolean;
  height?: number;
  /** 行选择 */
  rowSelection?: TableProps<T>['rowSelection'];
}

export default function DataTable<T extends AnyRecord>({
  data,
  loading,
  pagination = true,
  virtualScroll,
  height,
  rowSelection,
  ...rest
}: DataTableProps<T>) {
  // 判断是分页数据还是数组数据
  const isPaginated = data && 'data' in data && typeof (data as PaginatedResponse<T>).data === 'object';
  const dataSource = isPaginated ? (data as PaginatedResponse<T>).data.items : (data as T[]) || [];
  const total = isPaginated ? (data as PaginatedResponse<T>).data.total : dataSource?.length || 0;

  const paginationConfig: TableProps<T>['pagination'] =
    pagination === false
      ? false
      : {
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t: number) => `共 ${t} 条`,
          pageSizeOptions: ['10', '20', '50', '100'],
          ...(typeof pagination === 'object' ? pagination : {}),
        };

  return (
    <Table<T>
      dataSource={dataSource}
      loading={loading}
      pagination={paginationConfig}
      rowKey="id"
      rowSelection={rowSelection}
      scroll={virtualScroll ? { y: height || 600 } : rest.scroll}
      virtual={virtualScroll}
      size="middle"
      style={{ background: 'var(--bg-secondary)' }}
      {...rest}
    />
  );
}
