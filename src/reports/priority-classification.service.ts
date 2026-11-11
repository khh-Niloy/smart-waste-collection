import { Injectable } from '@nestjs/common';
import { ReportPriority } from '../common/enums/report-priority.enum';
import { WasteCategory } from '../common/enums/waste-category.enum';

export interface ClassificationInput {
  category: WasteCategory;
  description: string;
  address: string;
  area?: string;
  ward?: string;
}

export interface ClassificationResult {
  priority: ReportPriority;
  explanation: string;
  matchedRule: string;
}

const URGENT_KEYWORDS = [
  'chemical',
  'acid',
  'toxic',
  'biohazard',
  'medical waste',
  'syringe',
  'needle',
  'hospital waste',
  'asbestos',
  'flammable',
  'fuel spill',
  'oil spill',
  'gas leak',
  'pesticide',
  'mercury',
  'battery acid',
  'explosive',
  'hazardous',
  'sewage overflow',
  'raw sewage',
];

const HIGH_SENSITIVE_SITE_KEYWORDS = [
  'hospital',
  'clinic',
  'medical center',
  'school',
  'college',
  'kindergarten',
  'nursery',
  'playground',
  'daycare',
  'university',
  'market',
  'water supply',
];

const HIGH_DISRUPTION_KEYWORDS = [
  'blocking road',
  'road blocked',
  'traffic',
  'drainage blocked',
  'drain blocked',
  'flooding',
  'burning',
  'fire',
  'smoke',
  'large pile',
  'massive',
  'huge',
  'truckload',
  'days uncollected',
  'unbearable',
  'rats',
  'rodents',
  'stray dogs',
  'overflowing everywhere',
  'public disruption',
];

const LOW_KEYWORDS = [
  'minor',
  'small',
  'little',
  'single bag',
  'few wrappers',
  'light litter',
  'cosmetic',
];

/**
 * Transparent rule-based priority classifier for municipal waste reports.
 */
@Injectable()
export class PriorityClassificationService {
  classify(input: ClassificationInput): ClassificationResult {
    const combinedText = [
      input.description,
      input.address,
      input.area ?? '',
      input.ward ?? '',
    ]
      .join(' ')
      .toLowerCase();

    // 1. URGENT rules
    if (input.category === WasteCategory.HAZARDOUS_WASTE) {
      return {
        priority: ReportPriority.URGENT,
        matchedRule: 'CATEGORY_HAZARDOUS_WASTE',
        explanation:
          'Classified as URGENT because the report category is Hazardous Waste, requiring immediate containment.',
      };
    }

    const matchedUrgentKeyword = this.findMatchedKeyword(
      combinedText,
      URGENT_KEYWORDS,
    );
    if (matchedUrgentKeyword) {
      return {
        priority: ReportPriority.URGENT,
        matchedRule: `URGENT_KEYWORD:${matchedUrgentKeyword.toUpperCase()}`,
        explanation: `Classified as URGENT because the report mentions dangerous material or contamination ("${matchedUrgentKeyword}").`,
      };
    }

    // 2. HIGH rules
    const matchedSensitiveSite = this.findMatchedKeyword(
      combinedText,
      HIGH_SENSITIVE_SITE_KEYWORDS,
    );
    if (matchedSensitiveSite) {
      return {
        priority: ReportPriority.HIGH,
        matchedRule: `SENSITIVE_SITE:${matchedSensitiveSite.toUpperCase()}`,
        explanation: `Classified as HIGH priority because waste is reported near a sensitive public location ("${matchedSensitiveSite}").`,
      };
    }

    const matchedDisruption = this.findMatchedKeyword(
      combinedText,
      HIGH_DISRUPTION_KEYWORDS,
    );
    if (matchedDisruption) {
      return {
        priority: ReportPriority.HIGH,
        matchedRule: `HIGH_DISRUPTION:${matchedDisruption.toUpperCase()}`,
        explanation: `Classified as HIGH priority due to significant accumulation or public disruption ("${matchedDisruption}").`,
      };
    }

    if (
      input.category === WasteCategory.ILLEGAL_WASTE_DUMPING &&
      /(overflow|dump|heap|pile|multiple|blocking)/.test(combinedText)
    ) {
      return {
        priority: ReportPriority.HIGH,
        matchedRule: 'ILLEGAL_DUMPING_SIGNIFICANT',
        explanation:
          'Classified as HIGH priority because illegal dumping with significant accumulation was described.',
      };
    }

    // 3. LOW rules
    const matchedLow = this.findMatchedKeyword(combinedText, LOW_KEYWORDS);
    if (input.category === WasteCategory.OTHER || matchedLow) {
      if (
        matchedLow &&
        input.category !== WasteCategory.OVERFLOWING_GARBAGE_BIN
      ) {
        return {
          priority: ReportPriority.LOW,
          matchedRule: `LOW_MINOR_ISSUE:${matchedLow.toUpperCase()}`,
          explanation: `Classified as LOW priority as a minor waste issue with no immediate safety hazard ("${matchedLow}").`,
        };
      }
      if (input.category === WasteCategory.OTHER) {
        return {
          priority: ReportPriority.LOW,
          matchedRule: 'CATEGORY_OTHER_MINOR',
          explanation:
            'Classified as LOW priority for general non-hazardous waste inquiry with no immediate danger.',
        };
      }
    }

    // 4. NORMAL default rules
    if (input.category === WasteCategory.MISSED_WASTE_COLLECTION) {
      return {
        priority: ReportPriority.NORMAL,
        matchedRule: 'CATEGORY_MISSED_COLLECTION',
        explanation:
          'Classified as NORMAL priority for scheduled missed waste collection follow-up.',
      };
    }

    return {
      priority: ReportPriority.NORMAL,
      matchedRule: 'STANDARD_COLLECTION_ISSUE',
      explanation:
        'Classified as NORMAL priority as a standard municipal waste collection issue.',
    };
  }

  private findMatchedKeyword(text: string, keywords: string[]): string | null {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return keyword;
      }
    }
    return null;
  }
}
