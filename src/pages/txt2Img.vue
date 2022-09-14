<template lang='pug'>
q-page
  .q-pa-md
    .q-gutter-y-md
      q-card
        q-card-section
          q-tabs(v-model='tab' dense='' align='left' narrow-indicator='')
            q-tab(name='Images' label='Quick Prompt')
          q-separator
          //- Images tab
          q-tab-panels(v-model='tab' animated='')
            q-tab-panel(name='Images')
              //- @todo Add random placeholders
              q-input(v-model='prompt' label='Prompt' placeholder='a dr seuss illustration of robots building a city' autogrow @change='autosave')
                template(v-slot:append='')
                  q-btn(color='primary' label='Dream' icon='bubble_chart' :disabled='isStoppingDream' @click='queueDream')
                    //- q-tooltip(v-if='!settings.server || !settings.server.length' content-class='bg-red' content-style='font-size: 1em')
                    //-   | No servers selected
                  q-btn(v-if='isDreaming || isStoppingDream' :disabled='isStoppingDream' :loading='isStoppingDream' color='negative' label='Stop' icon='cancel' @click='stopDreaming')
              q-linear-progress.q-mt-md(size='20px' v-if='isDreaming || isStoppingDream' :value='dreamProgress' stripe='')
  .q-pa-md
    .q-col-gutter-md.row.items-start
      //- Config
      .col-4
        q-card
          q-card-section
            //- Basics
            q-badge Steps: {{ steps }} 
            q-slider(v-model='steps' :min='1' :max='150' :step='1' @change='autosave')
            q-badge Width: {{ width }} 
            q-slider(v-model='width' :min='64' :max='2048' :step='64' @change='autosave' snap='')
            q-badge Height: {{ height }} 
            q-slider(v-model='height' :min='64' :max='2048' :step='64' @change='autosave' snap='')
            //- Batches
            q-badge Batch Size: {{ batchSize }} 
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
import {mapState} from 'vuex'
import store from 'store'

const autosaveFields = ['queue', 'tab', 'prompt', 'sessionHash', 'imgs', 'width', 'height', 'steps', 'batchSize']

export default {
  name: 'IndexPage',

  computed: {
    ...mapState(['settings']),
  },

  mounted () {
    // Handle autosave fields
    const $onloadData = store.get('txt2Img') || {}
    autosaveFields.forEach(key => {
      // Load settings
      if ($onloadData.hasOwnProperty(key)) {
        this[key] = $onloadData[key]
      }

      // Add autosave watchers
      this.$watch(key, this.autosave, {deep: true})
    })
  },

  data: () => ({
    queue: [],
    curDream: {},
    tab: 'Images',
    prompt: '',
    // @todo add this to config
    defaultPrompt: 'a dr seuss illustration of robots building a city',
    // @todo generate and persist this (and do we even need this?)
    sessionHash: '3exs9au2lti',

    imgs: [],
    width: 512,
    height: 512,
    steps: 40,

    isDreaming: false,
    isStoppingDream: false,
    dreamCheckInterval: 750, // milliseconds
    dreamProgress: 0,

    numBatches: 1,
    batchSize: 1,

    imageModal: false,
    imageModalActiveImage: null,
  }),
  
  methods: {
    /**
     * Queues up the dream and runs them if able to
     */
    queueDream () {
      // @todo We shouldn't need these conditionals,
      // instead set defaults when loading store
      if (!this.queue) {this.queue = []}

      // Create the batch
      const batch = []
      for (let i = 0; i < this.batchSize; i++) {
        // Remove extra fields
        const data = Object.assign({}, this.txt2Img)
        delete data.queue
        batch.push(data)
      }
      this.queue.push(...batch)

      // Check and start the next dream
      this.checkDream(this.startNextDream)
    },

    /**
     * Check dream
     * @param awakeCb Callback to call if there are no dreams
     */
    checkDream (awakeCb) {
      // Exit if no servers
      if (!this.settings.servers.length) {
        this.$q.notify({
          message: 'No servers selected. Set one in Settings',
          position: 'top',
          color: 'red'
        })
        return
      }
      
      // Loop through each server and try to find an available one to run
      let hasFoundAvailableServer = false
      for (let serverId = 0; serverId < this.settings.servers.length; serverId++) {
        const api = axios.create({ baseURL: this.settings.servers[serverId].base })

        api
        .post('/api/predict', {
          fn_index: 4,
          data: [],
          session_hash: this.sessionHash,
        })
        .then((response) => {
          const data = response.data.data[0]

          // Checking to run
          // If a server is available, start the dream. Otherwise wait a bit and check again
          if (awakeCb) {
            if (!data.isGenerating) {
              !hasFoundAvailableServer && this.startNextDream(api, serverId)
              hasFoundAvailableServer = true
            } else {
              if (!hasFoundAvailableServer) {
                setTimeout(() => this.checkDream(awakeCb), this.dreamCheckInterval)
              }
            }

          // Checking to get percent
          } else {

            // If we're dreaming, update the progress instead
            // @todo handle multiple dreams
            if (data.isGenerating) {
  
              // Create a dummy DOM to extract the progress
              const $dom = document.createElement('div')
              $dom.innerHTML = data
              const $width = $dom.querySelector('.progress')
  
              // Update progress in UI
              if ($width?.innerHTML) {
                this.dreamProgress =
                  parseInt($width.innerHTML.replace('%', '')) / 100
              } else {
                this.dreamProgress = 0
              }
  
              // Check the dream again
              if (this.isDreaming) {
                setTimeout(() => {
                  this.checkDream()
                }, this.dreamCheckInterval)
              }
            }
          }
        })
        .catch(err => {
          this.$q.notify({
            color: 'negative',
            position: 'top',
            message: `Error checking dream: ${err}`,
            icon: 'report_problem',
          })
        })
      }
    },

    /**
     * Starts the dream and occasionally checks in to update progress
     */
    startDream (api) {
      this.isDreaming = true

      setTimeout(() => {
        this.checkDream()
      }, 0)

      // example: https://29390.gradio.app
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
          // // Clean data
          // const data = []
          // response.data.data.forEach((val) => {
          //   data.push(val)
          // })
          // console.log('RESPONSE', data, response)

          // const imgs = []
          // data[0].forEach((img) => {
          //   imgs.push(img)
          // })

          // this.imgs.push(...imgs)
          // this.status = data[1]

          // // Run next in queue
          // this.queue.unshift()
          // if (this.queue.length) {
          //   console.log('test', this.queue)
          // }
        })
        .finally(() => {
          this.isDreaming = false
          this.isStoppingDream = false
        })
        .catch((err) => {
          this.$q.notify({
            color: 'negative',
            position: 'top',
            message: `Prompting failed: ${err}`,
            icon: 'report_problem',
          })
        })
    },

    /**
     * Stop Dreaming
     *
     */
    stopDreaming () {
      this.isStoppingDream = true

      const api = axios.create({ baseURL: this.settings.servers[0].base })
      api
        .post('/api/predict', {
          fn_index: 5,
        })
        // @todo catch error
        .then(() => {
          this.isDreaming = false
        })
    },

    /**
     * Starts the next dream
     */
    startNextDream (api, serverId) {
      if (!this.queue.length) return
      
      // Get the next queued item
      const queue = [...this.queue[0]]
      let dream = queue.shift()

      if (!queue.length) {
        this.queue.shift()
      }
    },

    // @todo Add this as a generic prototype
    // @todo Let's revisit how we save after vuex upgrade
    // @todo 🚨 This should be throttled
    autosave () {
      const data = {}
      autosaveFields.forEach(key => {
        data[key] = this[key]
      })
      store.set('txt2Img', data)
    },

    expandImage (ev) {
      this.imageModal = true
      this.imageModalActiveImage = ev
    },
  },
}
</script>

  