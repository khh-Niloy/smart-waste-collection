import { ReportPriority } from '../common/enums/report-priority.enum';
import { WasteCategory } from '../common/enums/waste-category.enum';
import { PriorityClassificationService } from './priority-classification.service';

describe('PriorityClassificationService', () => {
  let service: PriorityClassificationService;

  beforeEach(() => {
    service = new PriorityClassificationService();
  });

  it('classifies HAZARDOUS_WASTE category as URGENT', () => {
    const result = service.classify({
      category: WasteCategory.HAZARDOUS_WASTE,
      description: 'Discarded industrial drums found behind warehouse.',
      address: 'Tejgaon Industrial Area, Dhaka',
    });

    expect(result.priority).toBe(ReportPriority.URGENT);
    expect(result.matchedRule).toBe('CATEGORY_HAZARDOUS_WASTE');
  });

  it('classifies chemical/medical keywords as URGENT regardless of category', () => {
    const result = service.classify({
      category: WasteCategory.ILLEGAL_WASTE_DUMPING,
      description: 'Broken syringes and medical waste dumped near alley.',
      address: 'Green Road, Dhaka',
    });

    expect(result.priority).toBe(ReportPriority.URGENT);
    expect(result.matchedRule).toContain('URGENT_KEYWORD');
  });

  it('classifies waste near hospitals or schools as HIGH priority', () => {
    const result = service.classify({
      category: WasteCategory.OVERFLOWING_GARBAGE_BIN,
      description:
        'Large bin overflowing directly outside the primary school gate.',
      address: 'Road 7, Dhanmondi, Dhaka',
    });

    expect(result.priority).toBe(ReportPriority.HIGH);
    expect(result.matchedRule).toContain('SENSITIVE_SITE');
  });

  it('classifies missed collection without escalation as NORMAL', () => {
    const result = service.classify({
      category: WasteCategory.MISSED_WASTE_COLLECTION,
      description: 'Residential street pickup was skipped this morning.',
      address: 'House 14, Block C, Banani',
    });

    expect(result.priority).toBe(ReportPriority.NORMAL);
    expect(result.matchedRule).toBe('CATEGORY_MISSED_COLLECTION');
  });

  it('classifies minor OTHER waste issues as LOW priority', () => {
    const result = service.classify({
      category: WasteCategory.OTHER,
      description: 'Minor scattered wrappers along the park bench path.',
      address: 'Lake Walkway, Gulshan',
    });

    expect(result.priority).toBe(ReportPriority.LOW);
  });
});
