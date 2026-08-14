import {
  History,
  Images,
  LayoutList,
  ListTree,
  Settings2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui';

export type ProductWorkspaceTab =
  | 'general'
  | 'organization'
  | 'media'
  | 'variants'
  | 'activity';

const tabs = [
  { id: 'general', label: 'اطلاعات', icon: LayoutList },
  { id: 'organization', label: 'دسته‌بندی و مجموعه', icon: ListTree },
  { id: 'media', label: 'تصاویر', icon: Images },
  { id: 'variants', label: 'گونه‌ها، قیمت و موجودی', icon: Settings2 },
  { id: 'activity', label: 'فعالیت', icon: History },
] as const satisfies ReadonlyArray<{
  id: ProductWorkspaceTab;
  label: string;
  icon: typeof LayoutList;
}>;

export function ProductWorkspaceTabs({
  onChange,
  value,
}: {
  readonly onChange: (tab: ProductWorkspaceTab) => void;
  readonly value: ProductWorkspaceTab;
}) {
  return (
    <Tabs
      dir="rtl"
      onValueChange={(next) => onChange(next as ProductWorkspaceTab)}
      value={value}
    >
      <div className="overflow-x-auto">
        <TabsList
          aria-label="بخش‌های کالا"
          className="min-w-max rounded-none bg-transparent p-0"
        >
          {tabs.map(({ icon: Icon, id, label }) => (
            <TabsTrigger
              className="min-h-11 rounded-none border-b-2 border-transparent px-4 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              key={id}
              value={id}
            >
              <Icon aria-hidden="true" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}
