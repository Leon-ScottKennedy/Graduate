<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { browseHardware } from '../../services/hardwareBrowse'
import { checkReplacement } from '../../services/buildCompatibility'
import type { PartGroup, PartOption } from '../../types/hardware'
import { money } from '../../utils/format'
import BuildManualQuotes from './BuildManualQuotes.vue'

const props = defineProps<{
  group: PartGroup
  selected: PartOption
  build: Record<string, PartOption>
}>()
const emit = defineEmits<{ replace: [option: PartOption] }>()
const keyword = ref('')
const brand = ref('')
const preview = ref<PartOption | null>(null)
const all = computed(() =>
  browseHardware(props.group).map((option) =>
    option.id === props.selected.id ? props.selected : option,
  ),
)
const brands = computed(() => [...new Set(all.value.map((option) => option.brand))])
const visible = computed(() =>
  all.value.filter(
    (option) =>
      (!brand.value || option.brand === brand.value) &&
      `${option.name} ${option.specs}`.toLowerCase().includes(keyword.value.trim().toLowerCase()),
  ),
)
const checks = computed(() =>
  Object.fromEntries(
    visible.value.map((option) => [
      option.id,
      checkReplacement(props.build, props.group.id, option),
    ]),
  ),
)
watch(
  () => props.group.id,
  () => {
    keyword.value = ''
    brand.value = ''
    preview.value = null
  },
)
function choose(option: PartOption) {
  emit('replace', option)
  preview.value = null
}
</script>

<template>
  <div>
    <div class="browser-filters">
      <input
        v-model="keyword"
        aria-label="搜索全部型号"
        placeholder="搜索品牌、型号或规格"
      /><select v-model="brand" aria-label="筛选品牌">
        <option value="">全部品牌</option>
        <option v-for="name in brands" :key="name">{{ name }}</option>
      </select>
    </div>
    <p class="nb-jd-caption">
      {{ group.label }} · {{ visible.length }}/{{ all.length }} 款 · 全部档位，不限 ±20% 价格
    </p>
    <div v-if="preview" class="browser-preview">
      <div class="browser-preview-head">
        <strong>{{ preview.name }}</strong
        ><button type="button" @click="preview = null">收起</button>
      </div>
      <BuildManualQuotes
        :key="preview.id"
        :category="group.id"
        :selected="preview"
        :fallback="group.options[0]"
        @select="choose"
      />
    </div>
    <p v-if="!visible.length" class="nb-jd-caption">没有符合条件的型号，试试清空搜索或品牌筛选。</p>
    <div class="nb-candidates">
      <article
        v-for="option in visible"
        :key="option.id"
        :class="{ selected: selected.id === option.id }"
      >
        <div class="nb-candidate-top">
          <span class="nb-badge nb-brand-badge">{{ option.brand }}</span
          ><span v-if="selected.id === option.id">当前选用</span>
        </div>
        <h3>{{ option.name }}</h3>
        <p>{{ option.specs }}</p>
        <a
          v-if="option.specSource"
          :href="option.specSource"
          target="_blank"
          rel="noopener noreferrer"
          >官方型号资料 ↗</a
        >
        <strong
          >{{ option.requiresQuote ? '价格待录入' : money(option.price)
          }}<small v-if="!option.requiresQuote">{{
            option.priceSource ? '人工店铺报价' : '参考价'
          }}</small></strong
        >
        <button
          v-if="option.requiresQuote"
          type="button"
          class="nb-button nb-button-small"
          @click="preview = option"
        >
          查看 / 录入店铺报价
        </button>
        <button
          v-else
          type="button"
          class="nb-button nb-button-small"
          :disabled="selected.id === option.id || !!checks[option.id]?.errors.length"
          @click="choose(option)"
        >
          {{
            selected.id === option.id
              ? '已在配置中'
              : checks[option.id]?.errors.length
                ? '存在兼容冲突'
                : '替换到配置'
          }}
        </button>
        <small v-if="checks[option.id]?.errors.length" class="browser-warning">{{
          checks[option.id]?.errors[0]?.message
        }}</small>
        <small v-else class="browser-note"
          >{{
            option.requiresQuote ? '型号资料已收录，录入报价后可选配' : '本地参考价，非实时店铺报价'
          }}
          · 尺寸、BIOS 等仍需核验</small
        >
      </article>
    </div>
  </div>
</template>

<style scoped>
.browser-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.browser-filters input,
.browser-filters select {
  padding: 10px;
  min-width: 0;
  background: #16121c;
  border: 1px solid #51405e;
  color: #e9dff2;
  border-radius: 3px;
}
.browser-filters input {
  flex: 1 1 160px;
}
.browser-filters select {
  max-width: 100%;
}
.browser-preview {
  margin: 16px 0;
  padding: 14px;
  border: 1px solid #756184;
}
.browser-preview-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.browser-preview-head button {
  flex-shrink: 0;
  color: #c8afff;
  background: transparent;
  border: 0;
}
.nb-candidates article a {
  color: #bda5dc;
  font-size: 12px;
}
.nb-candidates article strong small {
  color: #aaa0b7;
  font-weight: normal;
  font-size: 12px;
  margin-left: 8px;
}
.browser-warning,
.browser-note {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.7;
  color: #aaa0b7;
}
.browser-warning {
  color: #e8bd61;
}
</style>
