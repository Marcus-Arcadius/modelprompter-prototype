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
                  q-btn(color='primary' label='Dream' icon='bubble_chart' :disabled='isWakingUp' @click='queueDream')
              template(v-for='server in servers')
                template(v-if='server.isChecking || server.isDreaming || server.isWakingUp')
                  .flex.q-mt-md
                    div
                      q-linear-progress(style='flex: 1' dense color='blue' size='20px' :value='+(server.dreamProgress)/100' stripe='')
                        span(style='position: absolute; width: 100%; text-align: center; color: #fff; display: block; font-size: .65em') {{server.base}}
                      q-linear-progress.q-mt-sm(color='negative' size='10px' :value='servers.length/(servers.length+queue.length)')
                        span(style='position: absolute; width: 100%; text-align: center; color: #fff; display: block; font-size: .8em')
                    div(style='flex: 0 0 120px')
                      q-btn.q-ml-md(style='height: 100%' color='negative' width='100px' icon='cancel' label='stop' @click='stopServer(server)')
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

const autosaveFields = ['queue', 'tab', 'prompt', 'sessionHash', 'lastImg', 'width', 'height', 'steps', 'batchSize']
const promptFields = {prompt: null, negative: null, sessionHash: null, width: null, height: null, steps: null, numBatches: null, batchSize: null}

export default {
  name: 'IndexPage',

  computed: {
    ...mapState(['settings']),

    servers: function () {
      return this.settings.servers.filter(server => server.enabled)
    },

    isDreaming: function () {
      return this.servers.some(server => server.isDreaming)
    },

    isWakingUp: function () {
      return this.servers.some(server => server.isWakingUp)
    },

    // @todo this smells like gefilte fish
    overallProgress: function () {
      if (!this.queue.length) {
        return 1
      } else {
        return this.servers.length / this.queue.length
      }
    }
  },

  mounted () {
    globalThis.a = this

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

    // Let's ping all servers on load to get current status
    this.servers.forEach(server => {
      // Let's force-start checking
      server.isChecking = false
      
      // @todo Use a method instead of axios.create directly incase of update
      const api = axios.create({baseURL: server.base})
      this.checkDream(server, api)
    })
  },

  data: () => ({
    queue: [],
    tab: 'Images',
    prompt: '',
    negative: '',
    
    // @todo add this to config
    defaultPrompt: 'a dr seuss illustration of robots building a city',
    // @todo generate and persist this (and do we even need this?)
    sessionHash: '3exs9au2lti',

    lastImg: {},
    imgs: [],
    width: 512,
    height: 512,
    steps: 40,

    dreamCheckInterval: 750, // milliseconds

    numBatches: 1,
    batchSize: 1,

    totalBatched: 0,

    imageModal: false,
    imageModalActiveImage: null,
  }),
  
  methods: {
    getQueueData () {
      const data = {}
      Object.keys(promptFields).forEach(key => {
        data[key] = this[key]
      })
      data.defaultPrompt = this.defaultPrompt
      return data
    },
    
    /**
     * Queues up the dream and runs them if able to
     */
    queueDream () {
      // Exit if no servers
      if (!this.servers.length) {
        this.$q.notify({
          message: 'No servers selected. Set one in Settings',
          position: 'top',
          color: 'red'
        })
        return
      }

      // Create the batch
      const batch = []
      for (let i = 0; i < this.batchSize; i++) {
        batch.push(this.getQueueData())
      }
      this.queue.push(...batch)

      // Check and start the next dream
      this.servers.forEach(server => {
        if (!server.isChecking) {
          // Loop through each server and try to find an available one to run
          const api = axios.create({ baseURL: server.base })

          server.isChecking = true
          this.checkDream(server, api)
        }
      })

      // Save the queue to localstorage
      this.autosave()
    },

    /**
     * Check dream
     */
    checkDream (server, api) {
      api
      .post('/api/predict', {
        fn_index: 4,
        data: [],
        session_hash: this.sessionHash,
      })
      .then((response) => {
        const data = response.data.data[0]
        server.lastResponse = data

        // Pick up from where we left off
        if (data) {
          server.isDreaming = true
          server.isChecking = true
        } else {
          server.isDreaming = false
        }
        // console.log('isChecking', server.base, response.data.data[0])

        // If we're dreaming, update the progress
        // @todo handle multiple dreams
        if (data) {
          // Create a dummy DOM to extract the progress
          const $dom = document.createElement('div')
          $dom.innerHTML = data
          const $width = $dom.querySelector('.progress')

          // Update progress in UI
          if ($width) {
            server.dreamProgress = parseInt($width.style.width.replace('%', ''))
          } else {
            server.dreamProgress = 0
          }

          // Check the dream again
          if (server.dreamProgress < 100) {
            setTimeout(() => {
              this.checkDream(server, api)
            }, this.dreamCheckInterval)
          } else {
            this.wakeUp(server, api)
          }

          // Update UI
          this.$nextTick(() => {
            this.$forceUpdate()
          })
        // Otherwise start dreaming if not dreaming
        } else if (!server.isDreaming) {
          this.startDream(server, api)
        }
      })
      .catch(err => {
        this.$q.notify({
          color: 'negative',
          position: 'top',
          multiLine: true,
          message: `${server.base} -- ${err}`,
          actions: [
            {
              label: 'Check servers',
              color: 'white',
              handler: () => {
                this.$router.push({path: '/settings'})
              }
            }
          ],
          icon: 'report_problem',
        })
        server.isDreaming = false
        server.isChecking = false
        console.log(err)
      })
    },

    /**
     * Starts the dream and occasionally checks in to update progress
     */
    startDream (server, api) {
      if (!this.queue.length) {
        this.wakeUp(server, api)
        return
      }
      
      // Start checking for progress
      server.isDreaming = true
      server.isChecking = true
      server.dreamProgress = 0
      this.$nextTick(() => {
        this.$forceUpdate()

        setTimeout(() => {
          this.checkDream(server, api)
        }, this.dreamCheckInterval)
      })

      // Actuall start dream
      const data = this.queue.shift()
      api
        .post('/api/predict', {
          fn_index: 3,
          data: this.prepareData(data, server),
          session_hash: this.sessionHash,
        })
        .then((response) => {
          // Clean data
          const data = []
          response.data.data.forEach((val) => {
            data.push(val)
          })

          // Add the image to the queue
          if (data[0]) {
            const imgs = []
            data[0].forEach((img) => {
              imgs.unshift(img)
            })

            this.imgs.unshift(...imgs)
            this.lastImg = this.imgs[this.imgs.length-1]
          } else {
            this.$q.notify({
              color: 'negative',
              position: 'top',
              message: 'No images generated',
              icon: 'report_problem'
            })
          }

          // Run next in queue
          this.wakeUp(server, api)
          if (this.queue.length) {
            this.startDream(server, api)
          }
        })
        .catch((err) => {
          this.$q.notify({
            color: 'negative',
            position: 'top',
            message: `Prompting failed: ${err}`,
            icon: 'report_problem',
          })
          console.log(err)
        })
    },

    /**
     * Frees up local data and allows the server to be pinged again
     */
    wakeUp (server, api) {
      server.isChecking = false
      server.isDreaming = false

      this.$nextTick(() => {
        this.$forceUpdate()
      })
    },

    stopServer (server) {
      const api = axios.create({baseURL: server.base})
      api
        .post('/api/predict', {
          fn_index: 5,
        })
        // @todo catch error
        .then(() => {
          this.wakeUp(server, api)
        })
        .catch((err) => {
          this.$q.notify({
            color: 'negative',
            position: 'top',
            message: `Stopping txt2Img failed: ${err}`,
            icon: 'report_problem',
          })
        })
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

    /**
     * Converts data into a format for specific Stable Diffusion apis
     */
    prepareData (context, server) {
      let data, promptDictionary, defaults

      // Select statement based on data api
      switch (server.api || '1.4') {
        // @see https://github.com/AUTOMATIC1111/stable-diffusion-webui
        case '1.4':
          data = []
          promptDictionary = ['prompt', 'negative', '', 'steps', '', '', '', '', '', '', '', '', '', '', '', 'height', 'width', '', '', '', '', '', '', '', '']
          // promptDictionary = ['prompt', 'negative', '', 'steps', '', '', '', 'numBatches', 'batchSize', '', '', '', '', '', '', 'height', 'width', '', '', '', '', '', '', '', '']
          defaults = [context.defaultPrompt, '', 'None', 40, 'Euler a', false, false, 1, 1, 7, -1, -1, 0, 0, 0, context.height, context.width, 'None', null, 'Seed', '', 'Steps', '', false, []]
        
          // Build the data fro the given dictionary and defaults
          promptDictionary.forEach((key, n) => {
            if (key) {
              data.push(context[key] || defaults[n])
            } else {
              data.push(defaults[n])
            }
          })
        break
        
        // @see https://github.com/AUTOMATIC1111/stable-diffusion-webui
        case '1.5':
          data = []
          promptDictionary = ['prompt', 'negative', '', '', 'steps', '', '', '', '', '', '', '', '', '', '', '', 'height', 'width', '', '', '', '', '', '', '', '', '']
          // promptDictionary = ['prompt', 'negative', '', 'steps', '', '', '', 'numBatches', 'batchSize', '', '', '', '', '', '', 'height', 'width', '', '', '', '', '', '', '', '']
          defaults = [context.defaultPrompt, '', 'None', 'None', 40, 'Euler a', false, false, 1, 1, 7, -1, -1, 0, 0, 0, context.height, context.width, 'None', null, 'Seed', '', 'Steps', '', true, false, []]
        
          // Build the data fro the given dictionary and defaults
          promptDictionary.forEach((key, n) => {
            if (key) {
              data.push(context[key] || defaults[n])
            } else {
              data.push(defaults[n])
            }
          })
        break
      }
      
      return data
    }    
  },
}
</script>

  