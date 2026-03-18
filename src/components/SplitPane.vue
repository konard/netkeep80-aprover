<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Direction of the split */
    direction?: 'horizontal' | 'vertical'
    /** Minimum size of each pane in pixels */
    minSize?: number
    /** Initial sizes as percentages (must sum to 100 per pair) */
    initialSizes?: number[]
  }>(),
  {
    direction: 'horizontal',
    minSize: 100,
    initialSizes: () => [],
  }
)

const emit = defineEmits<{
  (e: 'resize'): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const sizes = ref<number[]>([])
const dragging = ref<number | null>(null)
const startPos = ref(0)
const startSizes = ref<number[]>([])

function initSizes(slotCount: number) {
  if (props.initialSizes && props.initialSizes.length === slotCount) {
    sizes.value = [...props.initialSizes]
  } else {
    const equalSize = 100 / slotCount
    sizes.value = Array(slotCount).fill(equalSize)
  }
}

function getPaneCount(): number {
  if (!containerRef.value) return 0
  let count = 0
  const children = containerRef.value.children
  for (let i = 0; i < children.length; i++) {
    if (children[i].classList.contains('split-pane')) {
      count++
    }
  }
  return count
}

function onMouseDown(index: number, e: MouseEvent) {
  e.preventDefault()
  dragging.value = index
  startPos.value = props.direction === 'horizontal' ? e.clientX : e.clientY
  startSizes.value = [...sizes.value]
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = props.direction === 'horizontal' ? 'col-resize' : 'row-resize'
  document.body.style.userSelect = 'none'
}

function onMouseMove(e: MouseEvent) {
  if (dragging.value === null || !containerRef.value) return

  const idx = dragging.value
  const containerRect = containerRef.value.getBoundingClientRect()
  const containerSize =
    props.direction === 'horizontal' ? containerRect.width : containerRect.height
  const currentPos = props.direction === 'horizontal' ? e.clientX : e.clientY
  const diff = currentPos - startPos.value
  const diffPercent = (diff / containerSize) * 100

  const newSizes = [...startSizes.value]
  const minPercent = (props.minSize / containerSize) * 100

  let newLeft = newSizes[idx] + diffPercent
  let newRight = newSizes[idx + 1] - diffPercent

  if (newLeft < minPercent) {
    newLeft = minPercent
    newRight = startSizes.value[idx] + startSizes.value[idx + 1] - minPercent
  }
  if (newRight < minPercent) {
    newRight = minPercent
    newLeft = startSizes.value[idx] + startSizes.value[idx + 1] - minPercent
  }

  newSizes[idx] = newLeft
  newSizes[idx + 1] = newRight
  sizes.value = newSizes
  emit('resize')
}

function onMouseUp() {
  dragging.value = null
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function onTouchStart(index: number, e: TouchEvent) {
  if (e.touches.length !== 1) return
  e.preventDefault()
  dragging.value = index
  const touch = e.touches[0]
  startPos.value = props.direction === 'horizontal' ? touch.clientX : touch.clientY
  startSizes.value = [...sizes.value]
  document.addEventListener('touchmove', onTouchMove, { passive: false })
  document.addEventListener('touchend', onTouchEnd)
}

function onTouchMove(e: TouchEvent) {
  if (dragging.value === null || !containerRef.value || e.touches.length !== 1) return
  e.preventDefault()

  const idx = dragging.value
  const containerRect = containerRef.value.getBoundingClientRect()
  const containerSize =
    props.direction === 'horizontal' ? containerRect.width : containerRect.height
  const touch = e.touches[0]
  const currentPos = props.direction === 'horizontal' ? touch.clientX : touch.clientY
  const diff = currentPos - startPos.value
  const diffPercent = (diff / containerSize) * 100

  const newSizes = [...startSizes.value]
  const minPercent = (props.minSize / containerSize) * 100

  let newLeft = newSizes[idx] + diffPercent
  let newRight = newSizes[idx + 1] - diffPercent

  if (newLeft < minPercent) {
    newLeft = minPercent
    newRight = startSizes.value[idx] + startSizes.value[idx + 1] - minPercent
  }
  if (newRight < minPercent) {
    newRight = minPercent
    newLeft = startSizes.value[idx] + startSizes.value[idx + 1] - minPercent
  }

  newSizes[idx] = newLeft
  newSizes[idx + 1] = newRight
  sizes.value = newSizes
  emit('resize')
}

function onTouchEnd() {
  dragging.value = null
  document.removeEventListener('touchmove', onTouchMove)
  document.removeEventListener('touchend', onTouchEnd)
}

watch(
  () => sizes.value.length,
  () => {
    nextTick(() => {
      const count = getPaneCount()
      if (count > 0 && count !== sizes.value.length) {
        initSizes(count)
      }
    })
  }
)

onMounted(() => {
  nextTick(() => {
    const count = getPaneCount()
    if (count > 0) {
      initSizes(count)
    }
  })
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('touchmove', onTouchMove)
  document.removeEventListener('touchend', onTouchEnd)
})

defineExpose({ sizes, initSizes })
</script>

<template>
  <div
    ref="containerRef"
    class="split-container"
    :class="[direction, { dragging: dragging !== null }]"
  >
    <template v-for="(size, index) in sizes" :key="'pane-' + index">
      <div
        class="split-pane"
        :style="{
          [direction === 'horizontal' ? 'width' : 'height']: size + '%',
        }"
      >
        <slot :name="'pane-' + index" :size="size" :index="index" />
      </div>
      <div
        v-if="index < sizes.length - 1"
        class="split-gutter"
        :class="direction"
        @mousedown="onMouseDown(index, $event)"
        @touchstart="onTouchStart(index, $event)"
      >
        <div class="gutter-handle" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.split-container {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.split-container.horizontal {
  flex-direction: row;
}

.split-container.vertical {
  flex-direction: column;
}

.split-pane {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.split-gutter {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: background-color 0.15s;
}

.split-gutter.horizontal {
  width: 6px;
  cursor: col-resize;
}

.split-gutter.vertical {
  height: 6px;
  cursor: row-resize;
}

.split-gutter:hover,
.split-container.dragging .split-gutter {
  background-color: rgba(102, 126, 234, 0.3);
}

.gutter-handle {
  border-radius: 2px;
  background-color: #475569;
  transition: background-color 0.15s;
}

.split-gutter.horizontal .gutter-handle {
  width: 2px;
  height: 32px;
}

.split-gutter.vertical .gutter-handle {
  width: 32px;
  height: 2px;
}

.split-gutter:hover .gutter-handle,
.split-container.dragging .gutter-handle {
  background-color: #667eea;
}
</style>
