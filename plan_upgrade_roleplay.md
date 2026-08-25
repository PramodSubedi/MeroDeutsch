# Roleplay Module Upgrade Plan

## Overview
Upgrade the conversational scenario definitions to address coverage gaps, structural inconsistencies, and CEFR level imbalances identified in the current `conversational_scenario_defs.json`.

## Current State Analysis
- **9 scenarios**, **28 variants**, **69 step entries**
- A1: 1 scenario, A2-B1: 1 scenario, A1-A2: 3 scenarios, A1-B1: 4 scenarios
- Missing topics: medical, emergency, phone, bank, post office, restaurant service
- Structural inconsistencies in option formats and Nepali translation distribution

## upgrade Objectives

### 1. Balance CEFR Distribution
- Add 2-3 A1-only scenarios
- Add 2 A2-B1 scenarios  
- Ensure even distribution across A1, A2, B1 levels

### 2. Add Missing Situational Topics
- [ ] Doctor/medical consultation (A2-B1)
- [ ] Emergency situations (A1-A2)
- [ ] Phone conversations (A1-A2)
- [ ] Bank/financial transactions (A1-A2)
- [ ] Restaurant service (A1-A2) - separate from café

### 3. Standardize Structure
- All scenarios: minimum 3 variants
- Consistent option format: `{ref, ok}` for correct, `{t, fb}` for alternatives
- Systematic Nepali translation inclusion where appropriate

### 4. Improve Coverage
- Increase total scenarios from 9 to 14-15
- Increase total steps from 69 to 120-150
- Add multilingual support (Nepali, English, German) systematically

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Standardize all existing scenario option formats
- [ ] Add Nepali translations to existing scenarios lacking them
- [ ] Fix `conv-intro` to have 3-4 variants (currently 1)
- [ ] Refactor data validation

### Phase 2: Content Expansion (Weeks 3-6)
- [ ] Add **Doctor/Medical** scenario (A2-B1)
- [ ] Add **Emergency** scenario (A1-A2)
- [ ] Add **Phone Call** scenario (A1-A2)
- [ ] Add **Bank/Financial** scenario (A1-A2)
- [ ] Add **Restaurant Service** scenario (A1-A2)

### Phase 3: Rebalancing (Weeks 7-8)
- [ ] Distribute scenarios evenly across CEFR levels
- [ ] Verify minimum 3 variants per scenario
- [ ] Ensure consistent field usage across all steps
- [ ] Update documentation

### Phase 4: Testing & Validation (Weeks 9-10)
- [ ] Run structural validation scripts
- [ ] Verify all option formats are consistent
- [ ] Test scenario flow completeness
- [ ] Check Nepali translation coverage

## Success Metrics
- **14-15 total scenarios** (up from 9)
- **3-4 variants per scenario** (up from 1-4, average >3)
- **Even CEFR distribution**: ~3 scenarios per level
- **<10% structural inconsistencies** (currently high variance)
- **90%+ Nepali translation coverage** for relevant scenarios

## Risks & Mitigation
- **Risk**: Inconsistent data formats across new scenarios
  - **Mitigation**: Create and enforce a schema/format template
- **Risk**: Incomplete scenario flows
  - **Mitigation**: Define complete step sequences before implementation
- **Risk**: Nepali translation quality issues
  - **Mitigation**: Use native speaker review or established translation patterns

## Next Steps
1. Review and approve this plan
2. Begin Phase 1: Standardize existing scenarios
3. Create schema template for new scenarios
4. Implement missing topic scenarios in Phase 2