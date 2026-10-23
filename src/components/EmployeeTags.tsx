import { Badge } from '@/components/ui/badge';
import type { EmployeeBrief, PositionType } from '../api/employees';

export const POSITION_LABELS: Record<PositionType, string> = {
  FrontendDeveloper: 'Frontend Developer',
  BackendDeveloper: 'Backend Developer',
  AndroidDeveloper: 'Android Developer',
  IosDeveloper: 'iOS Developer',
  QaEngineer: 'QA Engineer',
  DevOpsEngineer: 'DevOps Engineer',
  Designer: 'Designer',
  TechLead: 'Tech Lead',
};

// Грейд и должность — заливкой, оргструктура — контуром: как бейджи в ReviewPlatform.
export const TAG_STYLES = {
  grade: 'secondary',
  position: 'secondary',
  businessLine: 'outline',
  artName: 'outline',
  teamName: 'outline',
} as const;

export type TagType = keyof typeof TAG_STYLES;

export const getTagLabel = (type: TagType, value: string): string => {
  const labels: Record<string, (v: string) => string> = {
    grade: (v) => v,
    position: (v) => POSITION_LABELS[v as PositionType] || v,
    businessLine: (v) => v,
    artName: (v) => `ART: ${v}`,
    teamName: (v) => `Team: ${v}`,
  };
  return labels[type](value);
};

export interface EmployeeTag {
  type: TagType;
  value: string;
}

/** Порядок отображения тегов — общий для всех трёх мест, где они рисуются. */
const TAG_ORDER: readonly TagType[] = ['grade', 'position', 'businessLine', 'artName', 'teamName'];

/**
 * Собирает теги сотрудника в порядке отображения, пропуская незаполненные поля.
 *
 * @param only Ограничить набор — список сотрудников показывает только
 *   grade и position, остальные поля у него вынесены в отдельную колонку.
 *   Порядок берётся из TAG_ORDER независимо от порядка в этом аргументе.
 */
export function buildEmployeeTags(
  employee: EmployeeBrief,
  only?: readonly TagType[]
): EmployeeTag[] {
  return TAG_ORDER
    .filter((type) => only === undefined || only.includes(type))
    .map((type) => ({ type, value: employee[type] }))
    .filter((tag): tag is EmployeeTag => Boolean(tag.value));
}

interface Props {
  tags: readonly EmployeeTag[];
  /** Плотный вариант для табличного списка: уже горизонтальный отступ. */
  compact?: boolean;
}

/**
 * Только сами «пилюли», без обёртки.
 *
 * Обёртку каждое место вызова держит своё — у карточки, страницы активности и
 * табличного списка разные отступы и разные условия отрисовки, а вот сама
 * пилюля была скопирована во все три файла одинаково.
 */
export default function EmployeeTags({ tags, compact = false }: Props) {
  return (
    <>
      {tags.map((tag) => (
        <Badge key={tag.type} variant={TAG_STYLES[tag.type]} className={compact ? 'px-1.5' : undefined}>
          {getTagLabel(tag.type, tag.value)}
        </Badge>
      ))}
    </>
  );
}
