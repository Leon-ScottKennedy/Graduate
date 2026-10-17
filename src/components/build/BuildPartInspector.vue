<script setup lang="ts">
import { computed, ref } from 'vue'
import { getOffers } from '../../services/catalogService'
import type { PartGroup, PartOption } from '../../types/hardware'
import { money } from '../../utils/format'
const props = defineProps<{ group: PartGroup; selected: PartOption }>()
const emit = defineEmits<{ replace: [option: PartOption] }>()
const tab = ref('offers')
const tabs = [
  { id: 'offers', label: '平台报价' },
  { id: 'compare', label: '候选对比' },
]
const offers = computed(() => getOffers(props.selected.id))
const updatedAt = computed(() => offers.value[0]?.collectedAt ?? '暂无报价')
</script>

<template>
  <section class="nb-inspector nb-card" aria-labelledby="part-detail-title">
    <div class="nb-card-head">
      <div>
        <h2 id="part-detail-title">{{ selected.name }}</h2>
        <p>{{ selected.specs }}</p>
      </div>
      <span class="nb-badge nb-brand-badge">{{ selected.brand }}</span>
    </div>
    <div class="nb-tabs" role="tablist" aria-label="配件数据">
      <button
        v-for="item in tabs"
        :id="`part-tab-${item.id}`"
        :key="item.id"
        type="button"
        role="tab"
        :aria-selected="tab === item.id"
        :aria-controls="`part-panel-${item.id}`"
        :class="{ active: tab === item.id }"
        @click="tab = item.id"
      >
        {{ item.label }}
      </button>
    </div>
    <div
      v-if="tab === 'offers'"
      id="part-panel-offers"
      class="nb-tab-content"
      role="tabpanel"
      aria-labelledby="part-tab-offers"
    >
      <div class="nb-inline-note">
        <span>更新时间 {{ updatedAt }}</span>
      </div>
      <div class="nb-table-scroll">
        <table class="nb-table">
          <thead>
            <tr>
              <th>平台 / 店铺</th>
              <th>价格口径</th>
              <th>商品报价</th>
              <th>与最低价差</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(offer, index) in offers" :key="offer.shop">
              <td>
                <span class="nb-platform" :class="offer.platform === 'jd' ? 'jd' : 'tb'">{{
                  offer.platform === 'jd' ? '京东' : '淘宝'
                }}</span
                ><small>{{ offer.shop }}</small>
              </td>
              <td>标准报价</td>
              <td class="nb-price">
                {{ money(offer.price) }}<span v-if="index === 0" class="nb-lowest">最低价</span>
              </td>
              <td>{{ index === 0 ? '—' : `+${money(offer.price - selected.price)}` }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div
      v-else-if="tab === 'compare'"
      id="part-panel-compare"
      class="nb-tab-content"
      role="tabpanel"
      aria-labelledby="part-tab-compare"
    >
      <div class="nb-candidates">
        <article
          v-for="option in group.options"
          :key="option.id"
          :class="{ selected: selected.id === option.id }"
        >
          <div class="nb-candidate-top">
            <span class="nb-badge nb-brand-badge">{{ option.brand }}</span
            ><span v-if="selected.id === option.id" class="nb-accent">当前选用</span>
          </div>
          <h3>{{ option.name }}</h3>
          <p>{{ option.specs }} · {{ option.tag }}</p>
          <strong>{{ money(option.price) }}</strong
          ><button
            class="nb-button nb-button-small"
            type="button"
            :disabled="selected.id === option.id"
            @click="emit('replace', option)"
          >
            {{ selected.id === option.id ? '已在配置中' : '替换到配置' }}
          </button>
        </article>
      </div>
    </div>
  </section>
</template>
