// src/models/story-output.js — P31 故事生成输出结构
// 对应规格：Agent 对话 Skill §10

/**
 * @typedef {Object} StoryOutput
 * @property {Object}  food                - 吃食信息
 * @property {Object}  people              - 人物信息
 * @property {Object}  scene               - 场景信息（location.city 必填）
 * @property {Object}  emotion             - 情感信息
 * @property {Array}   relatedFoods        - 关联吃食
 * @property {Object}  storySuggestions    - 故事建议
 * @property {Array}   grayAnchorSuggestions - 灰锚点建议
 */

/**
 * 从对话状态构建故事输出
 */
export function buildStoryOutput(conversationState) {
  const { food, people, scene, emotion, relatedFoods } = conversationState;
  return {
    food: { ...food },
    people: { ...people },
    scene: {
      ...scene,
      location: {
        ...scene.location,
        // TODO: 从城市名查经纬度 geo_point
      },
    },
    emotion: {
      coreFeeling: emotion.feeling || '',
      stories: emotion.stories.map(s => ({
        summary: s.summary || s,
        detail: s.detail || '',
        emotionalTone: s.emotionalTone || '',
      })),
      generationalConnection: emotion.generational || '',
      personalMeaning: emotion.personalMeaning || '',
    },
    relatedFoods: relatedFoods.map(rf => ({
      name: rf.name || rf,
      relation: rf.relation || '',
      sourceQuote: rf.sourceQuote || '',
    })),
    storySuggestions: {
      angle: `${scene.location.city ? '在' + scene.location.city : ''}的故事`,
      tone: '温暖怀旧',
      keyQuotes: [],
    },
    grayAnchorSuggestions: relatedFoods.map(rf => ({
      foodName: rf.name || rf,
      source: '对话中用户提及',
      contextQuote: rf.sourceQuote || '',
      suggestedPerson: people.mainPerson || null,
      suggestedLabel: '提到过',
    })),
  };
}
