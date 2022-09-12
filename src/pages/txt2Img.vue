<template lang='pug'>
q-page
  .q-pa-md
    .q-gutter-y-md
      q-card
        q-card-section
          q-tabs(v-model='txt2Img.tab' dense='' align='left' narrow-indicator='')
            q-tab(name='Images' label='Images')
          q-separator
          //- Images tab
          q-tab-panels(v-model='txt2Img.tab' animated='')
            q-tab-panel(name='Images')
              //- @todo Add random placeholders
              q-input(v-model='txt2Img.prompt' label='Prompt' placeholder='a dr seuss illustration of robots building a city' autogrow='' @change='autosave')
                template(v-slot:append='')
                  q-btn(color='primary' label='Dream' icon='smart_toy' :disabled='txt2Img.isStoppingDream' @click='maybeDream')
                    q-btn(v-if='txt2Img.isDreaming || txt2Img.isStoppingDream' :disabled='txt2Img.isStoppingDream' :loading='txt2Img.isStoppingDream' color='negative' label='Stop' icon='cancel' @click='stopDreaming')
              q-linear-progress.q-mt-md(size='20px' v-if='txt2Img.isDreaming || txt2Img.isStoppingDream' :value='txt2Img.dreamProgress' stripe='')
  .q-pa-md
    .q-col-gutter-md.row.items-start
      //- Config
      .col-4
        //- Basics
        q-badge(color='secondary') Steps: {{ txt2Img.steps }} 
        q-slider(v-model='txt2Img.steps' :min='1' :max='150' :step='1' @change='autosave')
        q-badge(color='secondary') Width: {{ txt2Img.width }} 
        q-slider(v-model='txt2Img.width' :min='64' :max='2048' :step='64' @change='autosave' snap='')
        q-badge(color='secondary') Height: {{ txt2Img.height }} 
        q-slider(v-model='txt2Img.height' :min='64' :max='2048' :step='64' @change='autosave' snap='')
        //- Batches
        .q-col-gutter-md.row.items-start.q-mt-lg
          .col-6
            q-badge(color='secondary') Batches: {{ txt2Img.numBatches }} 
            q-input(dense='' type='number' min='1' v-model.number='txt2Img.numBatches' @change='autosave')
          .col-6
            q-badge(color='secondary') Batch Size: {{ txt2Img.batchSize }} 
            q-input(dense='' type='number' min='1' v-model.number='txt2Img.batchSize' @change='autosave')
      //- Gallery
      .col-8
        .q-col-gutter-md.row.items-start
          .col-4(v-for='(img, key) in txt2Img.imgs' :key='key')
            q-card.cursor-pointer(@click='expandImage(img)')
              q-card-section.q-pa-sm
                q-img(:src='img')
  //- Image Modal
  q-dialog(v-model='txt2Img.imageModal')
    q-card.my-card(style='min-width: 300px')
      q-img(:src='txt2Img.imageModalActiveImage' style='height: 300px')
      q-card-section
</template>



<script>
import axios from 'axios'
import {mapState} from 'vuex'
import store from 'store'
const storeKeys = ['tab', 'prompt', 'defaultPrompt', 'sessionHash', 'imgs', 'width', 'height', 'steps', 'isDreaming', 'isStoppingDream', 'dreamCheckInterval', 'dreamProgress', 'numBatches', 'batchSize', 'imageModal', 'imageModalActiveImage']

export default {
  name: 'IndexPage',

  computed: {
    ...mapState(['txt2Img'])
  },

  beforeMount () {
    const localData = store.get(this.$options.name)
    this.$store.commit('set', ['txt2Img', localData])
  },

  methods: {
    maybeDream() {
      if (!this.txt2Img.isDreaming) {
        this.startDream()
      }
    },

    /**
     * Check dream
     */
    checkDream() {
      const api = axios.create({ baseURL: this.txt2Img.servers[0].base })

      api
        .post('/api/predict', {
          fn_index: 4,
          data: [],
          session_hash: this.txt2Img.sessionHash,
        })
        .then((response) => {
          const data = response.data.data[0]

          const $dom = document.createElement('div')
          $dom.innerHTML = data
          const $width = $dom.querySelector('.progress')

          if ($width?.innerHTML) {
            this.txt2Img.dreamProgress =
              parseInt($width.innerHTML.replace('%', '')) / 100
          } else {
            this.txt2Img.dreamProgress = 0
          }

          if (this.txt2Img.isDreaming) {
            setTimeout(() => {
              this.txt2Img.checkDream()
            }, this.txt2Img.dreamCheckInterval)
          }
        })
      // @todo Add error message
    },

    /**
     * Starts the dream and occasionally checks in to update progress
     */
    startDream() {
      this.txt2Img.isDreaming = true

      setTimeout(() => {
        this.checkDream()
      }, 0)

      const api = axios.create({ baseURL: this.txt2Img.servers[0].base })
      api
        .post('/api/predict', {
          fn_index: 3,
          data: [
            // @todo make this configurable
            this.txt2Img.prompt || this.txt2Img.defaultPrompt,
            // negative_prompt
            '',
            // txt2img_prompt_style
            'None',
            // init_img
            this.txt2Img.steps,
            // sampler_index
            'Euler a',
            // restore_faces
            false,
            // tiling
            false,
            // batch_count
            this.txt2Img.numBatches,
            // batch_size
            this.txt2Img.batchSize,
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
            this.txt2Img.height,
            this.txt2Img.width,

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
          session_hash: this.txt2Img.sessionHash,
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

          this.txt2Img.imgs.push(...imgs)
          this.txt2Img.status = data[1]
        })
        .finally(() => {
          this.txt2Img.isDreaming = false
          this.txt2Img.isStoppingDream = false
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
      this.txt2Img.isStoppingDream = true

      const api = axios.create({ baseURL: this.txt2Img.servers[0].base })
      api
        .post('/api/predict', {
          fn_index: 5,
        })
        // @todo catch error
        .then(() => {
          this.txt2Img.isDreaming = false
        })
    },

    // @todo Add this as a generic prototype
    // @todo Let's revisit how we save after vuex upgrade
    autosave() {
      const opts = ['tab', 'prompt', 'defaultPrompt', 'sessionHash', 'imgs', 'width', 'height', 'steps', 'isDreaming', 'isStoppingDream', 'dreamCheckInterval', 'dreamProgress', 'numBatches', 'batchSize', 'imageModal', 'imageModalActiveImage']
      const data = {}
      opts.forEach((key) => {
        data[key] = this.txt2Img[key]
      })

      store.set(this.$options.name, data)
    },

    expandImage(ev) {
      this.txt2Img.imageModal = true
      this.txt2Img.imageModalActiveImage = ev
    },
  },
}
</script>

  