<template lang='pug'>
q-page
  .q-pa-md
    .q-gutter-y-md
      q-card
        q-card-section
          q-tabs.text-grey(v-model='tab' dense='' active-color='primary' indicator-color='primary' align='left' narrow-indicator='')
            q-tab(name='Images' label='Images')
          q-separator
          //- Images tab
          q-tab-panels(v-model='tab' animated='')
            q-tab-panel(name='Images')
              //- @todo Add random placeholders
              q-input(v-model='prompt' label='Prompt' placeholder='a dr seuss illustration of robots building a city' autogrow='' @change='autosave')
                template(v-slot:append='')
                  q-btn(color='primary' label='Dream' icon='smart_toy' :disabled='isStoppingDream' @click='maybeDream')
                    q-btn(v-if='isDreaming || isStoppingDream' :disabled='isStoppingDream' :loading='isStoppingDream' color='negative' label='Stop' icon='cancel' @click='stopDreaming')
              q-linear-progress.q-mt-md(size='20px' v-if='isDreaming || isStoppingDream' :value='dreamProgress' stripe='')
  .q-pa-md
    .q-col-gutter-md.row.items-start
      //- Config
      .col-4
        //- Basics
        q-badge(color='secondary') Steps: {{ steps }} 
        q-slider(v-model='steps' :min='1' :max='150' :step='1' @change='autosave')
        q-badge(color='secondary') Width: {{ width }} 
        q-slider(v-model='width' :min='64' :max='2048' :step='64' @change='autosave' snap='')
        q-badge(color='secondary') Height: {{ height }} 
        q-slider(v-model='height' :min='64' :max='2048' :step='64' @change='autosave' snap='')
          //- Batches
          .q-col-gutter-md.row.items-start.q-mt-lg
            .col-6
              q-badge(color='secondary') Batches: {{ numBatches }} 
              q-input(dense='' type='number' min='1' v-model.number='numBatches' @change='autosave')
            .col-6
              q-badge(color='secondary') Batch Size: {{ batchSize }} 
              q-input(dense='' type='number' min='1' v-model.number='batchSize' @change='autosave')
      //- Gallery
      .col-8
        .q-col-gutter-md.row.items-start
          .col-4(v-for='(img, key) in imgs' :key='key')
            q-card.cursor-pointer(@click='expandImage(img)')
              q-card-section.q-pa-sm
                q-img(:src='img')
  //- Image Modal
  q-dialog(v-model='imageModal')
    q-card.my-card(style='min-width: 300px')
      q-img(:src='imageModalActiveImage' style='height: 300px')
      q-card-section
</template>



<script>
import axios from 'axios'

export default {
  name: 'IndexPage',
  data: () => ({
    tab: 'Images',

    prompt: '',
    defaultPrompt: 'a dr seuss illustration of robots building a city',
    // @todo generate and persist this
    sessionHash: 'gwoivb63nj4',

    imgs: [],
    // width: 512,
    // height: 512,
    // steps: 20,
    width: 64,
    height: 64,
    steps: 3,

    isDreaming: false,
    isStoppingDream: false,
    dreamCheckInterval: 750, // milliseconds
    dreamProgress: 0,

    numBatches: 1,
    batchSize: 1,

    imageModal: false,
    imageModalActiveImage: null,
  }),

  beforeMount() {
    // globalThis.$$PAGE = this
    // loadStates(this.$options.name, this, this.$options.data())
  },

  setup() {
    // const $servers = serversStore()

    // return {
    //   servers: computed(() => $servers.servers),
    // }
  },

  methods: {
    maybeDream() {
      if (!this.isDreaming) {
        this.startDream()
      }
    },

    /**
     * Check dream
     */
    checkDream() {
      const api = axios.create({ baseURL: this.servers[0].base })

      api
        .post('/api/predict', {
          fn_index: 4,
          data: [],
          session_hash: this.sessionHash,
        })
        .then((response) => {
          const data = response.data.data[0]

          const $dom = document.createElement('div')
          $dom.innerHTML = data
          const $width = $dom.querySelector('.progress')

          if ($width?.innerHTML) {
            this.dreamProgress =
              parseInt($width.innerHTML.replace('%', '')) / 100
          } else {
            this.dreamProgress = 0
          }

          if (this.isDreaming) {
            setTimeout(() => {
              this.checkDream()
            }, this.dreamCheckInterval)
          }
        })
      // @todo Add error message
    },

    /**
     * Starts the dream and occasionally checks in to update progress
     */
    startDream() {
      this.isDreaming = true

      setTimeout(() => {
        this.checkDream()
      }, 0)

      const api = axios.create({ baseURL: this.servers[0].base })
      api
        .post('/api/predict', {
          fn_index: 3,
          data: [
            // @todo make this configurable
            this.prompt || this.defaultPrompt,
            // negative_prompt
            '',
            // txt2img_prompt_style
            'None',
            // init_img
            this.steps,
            // sampler_index
            'Euler a',
            // restore_faces
            false,
            // tiling
            false,
            // batch_count
            this.numBatches,
            // batch_size
            this.batchSize,
            // cfg_scale
            7,
            // seed
            -1,
            // subseed
            -1,
            // subseed_strength
            0,
            // seed_resize_from_h
            0,
            // seed_resize_from_w
            0,
            this.height,
            this.width,

            // Custom inputs
            'None',
            'Seed',
            '',
            'Steps',
            '',
            false,
            [],
            '',
            '',
          ],
          session_hash: this.sessionHash,
        })
        .then((response) => {
          // Clean data
          const data = []
          response.data.data.forEach((val) => {
            data.push(val)
          })

          const imgs = []
          data[0].forEach((img) => {
            imgs.push(img)
          })

          this.imgs.push(...imgs)
          this.status = data[1]
        })
        .finally(() => {
          this.isDreaming = false
          this.isStoppingDream = false
        })
      // @todo catch error
      // .catch(() => {
      //   this.$q.notify({
      //     color: 'negative',
      //     position: 'top',
      //     message: 'Loading failed',
      //     icon: 'report_problem',
      //   })
      // })
    },

    /**
     * Stop Dreaming
     *
     */
    stopDreaming() {
      this.isStoppingDream = true

      const api = axios.create({ baseURL: this.servers[0].base })
      api
        .post('/api/predict', {
          fn_index: 5,
        })
        // @todo catch error
        .then(() => {
          this.isDreaming = false
        })
    },

    // @todo Add this as a generic prototype
    autosave() {
      const opts = {}
      Object.keys(this.$options.data()).forEach((key) => {
        opts[key] = this[key]
      })

      this.$q.localStorage.set(this.$options.name, opts)
    },

    expandImage(ev) {
      this.imageModal = true
      this.imageModalActiveImage = ev
    },
  },
}
</script>

  