<template lang="pug">
q-page.full-height
  Workspace(ref='workspace' :options='options' :toolbox='toolbox' :blocks='[]' @change='workspaceEventHandler')
    q-item(@click='saveDiffblock' clickable)
      q-item-section(avatar)
        q-icon(color='secondary' name='fas fa-save')
      q-item-section.gt-sm
        q-badge(v-if='isUnsaved' color='negative' floating) Unsaved changes
        q-item-label.text-secondary Save Diffblock
    q-item.q-mb-lg(@click='showSettings' clickable)
      q-item-section(avatar)
        q-icon(name='fas fa-cogs')
      q-item-section.gt-sm
        q-item-label Diffblock Settings
    q-item(@click='dialog.confirmNew = true' clickable)
      q-item-section(avatar)
        q-icon(color='positive' name='fas fa-file')
      q-item-section.gt-sm
        q-item-label.text-positive New Diffblock
    q-item(@click='dialog.loadBlock = true' clickable)
      q-item-section(avatar)
        q-icon(color='positive' name='fas fa-folder-open')
      q-item-section.gt-sm
        q-item-label.text-positive Load Diffblock
    q-item.q-mb-lg(@click='dialog.remixConfirm = true' clickable)
      q-item-section(avatar)
        q-icon(color='positive' name='fas fa-copy')
      q-item-section.gt-sm
        q-item-label.text-positive Remix Diffblock
    q-item(@click='dialog.deleteConfirm = true' clickable)
      q-item-section(avatar)
        q-icon(color='negative' name='fas fa-trash')
      q-item-section.gt-sm
        q-item-label.text-negative Delete Diffblock

  //- Dialogs
  DialogConfirm(v-model='dialog.confirmNew'
    @accept='createNewDiffblock'
    icon='fas fa-file'
    title='Create new Diffblock?')
      p Are you sure you'd like to create a new Diffblock? Any unsaved changes will be lost.

  DialogConfirm(v-model='dialog.remixConfirm'
    @accept='remixDiffblock'
    icon='fas fa-copy'
    title='Remix this diffblock?')
      p Any unsaved changes to the current diffblock will be lost.
      p Are you sure you'd like to create a copy of this diffblock and open it?

  DialogConfirm(v-model='dialog.editSettings'
    @accept='updateSettings'
    bg='primary'
    icon='fas fa-cogs'
    title='Diffblock Settings'
    accept-label='Update')
      q-input.q-mb-md(ref='autofocus' label='Title' color='secondary' v-model='meta._title' filled)
      q-input(label='Description' color='secondary' v-model='meta._description' type='textarea' filled)
      
  DialogLoadDiffblock(v-model='dialog.loadBlock')

  DialogDeleteDiffblock(v-model='dialog.deleteConfirm' :diffblock='block')
</template>

<script>
import {throttle, cloneDeep, set, sortBy} from 'lodash'
import Workspace from '../components/Workspace'
import DialogLoadDiffblock from '../components/dialog/LoadDiffblock'
import DialogDeleteDiffblock from '../components/dialog/DeleteDiffblock'
import DialogConfirm from '../components/dialog/Confirm'
import store from 'store'
import Blockly from 'blockly'
import toolbox from '../assets/toolboxes/studio'

// @todo Replace this with: import {uid} from quasar, then uid()
// @see https://v1.quasar.dev/quasar-utils/other-utils#generate-uid
import {v4 as uuidv4} from 'uuid'

/**
 * @todo document
 */
export default {
  name: 'MainLayout',

  components: {Workspace, DialogConfirm, DialogLoadDiffblock, DialogDeleteDiffblock},

  computed: {
    /**
     * Returns the data used for saving this view
     * @returns {Object} save data
     */
    saveData () {
      return {
        title: this.meta.title,
        description: this.meta.description,
        ...this.block,
        workspace: Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(this.$refs.workspace.blockly))
      }
    }
  },

  /**
   * Initialize
   */
  mounted () {
    set(window, 'app.$studio', this)

    // Load workspace
    const currentStudio = store.get('currentStudio', {})
    if (currentStudio.workspace) {
      Blockly.Xml.domToWorkspace(
        Blockly.Xml.textToDom(currentStudio.workspace),
        this.$refs.workspace.blockly
      )
    } else {
      Blockly.Xml.domToWorkspace(
        Blockly.Xml.textToDom('<xml xmlns="https://developers.google.com/blockly/xml"></xml>'),
        this.$refs.workspace.blockly
      )
    }
    this.checkBookmarks()

    // Setup listeners
    this.$refs.workspace.blockly.addChangeListener(Blockly.Events.disableOrphans)
    this.$root.$on('studio.prevBookmark', this.prevBookmark)
    this.$root.$on('studio.nextBookmark', this.nextBookmark)
    for (let i = 0; i < 10; i++) {
      this.$mousetrap.bind(i.toString(), this.onNumberKeypress)
    }

    // Autosave with CTRL+S
    this.$mousetrap.bindGlobal('ctrl+s', ev => {
      ev.preventDefault()
      this.saveDiffblock()
    })
  },

  destroyed () {
    this.$mousetrap.unbind('ctrl+s')
    this.$root.$off('studio.prevBookmark', this.prevBookmark)
    this.$root.$off('studio.nextBookmark', this.nextBookmark)
    for (let i = 0; i < 10; i++) {
      this.$mousetrap.unbind(i.toString())
    }
  },

  watch: {
    /**
     * Resize main splitter
     */
    splitter: throttle(function () {
      store.set('splitter', this.splitter)
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'))
      })
    }, 50, {leading: true, trailing: true})
  },
  
  data () {
    const currentStudio = store.get('currentStudio', {})

    return {
      // Whether the autosave has been saved to a diffblock or not
      isUnsaved: store.get('isStudioUnsaved'),
      
      hasLoaded: false,
      
      // Current bookmark index
      currentBookmark: -1,

      block: {
        uuid: currentStudio.uuid || uuidv4()
      },

      meta: {
        // What gets saved
        title: currentStudio.title || 'Untitled',
        // Intermediary step (value inside modal)
        _title: currentStudio.title || 'Untitled',
        
        description: currentStudio.description || '',
        _description: currentStudio.description || ''
      },

      // Models for dialogs
      dialog: {
        confirmNew: false,
        deleteConfirm: false,
        editSettings: false,
        loadBlock: false,
        remixConfirm: false
      },
      
      // Blockly options
      // @see https://developers.google.com/blockly/guides/configure/web/configuration_struct
      options: {},
      toolbox: this.getToolbox(),

      // Spliter width in pixels
      splitter: store.get('splitter', window.innerWidth / 3)
    }
  },

  methods: {
    /**
     * Save states
     */
    autosave () {
      store.set('currentStudio', this.saveData)
      store.set('isStudioUnsaved', true)
      this.isUnsaved = true
    },

    /**
     * Save the diffblock
     */
    saveDiffblock () {
      const diffblocks = store.get('diffblocks', {})
      diffblocks[this.block.uuid] = this.saveData
      store.set('diffblocks', diffblocks)
      store.set('isStudioUnsaved', false)
      this.$store.commit('set', ['diffblocks', diffblocks])
      this.isUnsaved = false

      this.$q.notify({
        type: 'positive',
        message: `Diffblock "${diffblocks[this.block.uuid].title}" saved`,
        timeout: 2000
      })
    },

    /**
     * Creates a new diffblock
     */
    createNewDiffblock () {
      this.block.uuid = uuidv4()
      store.remove('currentStudio')
      this.$store.commit('tally', 'reloads')
      this.$store.commit('set', ['lastEvent', {log: 'New diffblock created'}])
    },

    /**
     * Create a clone of a diffblock
     */
    remixDiffblock () {
      this.block.uuid = uuidv4()
      this.meta.title += ' [Remixed]'

      this.autosave()
      this.saveDiffblock()
      
      this.$store.commit('tally', 'reloads')
    },

    /**
     * Shows settings modal, reset its fields, focus element
     */
    showSettings () {
      this.meta._title = this.meta.title
      this.meta._description = this.meta.description
      this.dialog.editSettings = true
    },

    /**
     * Save and apply settings
     */
    updateSettings () {
      this.meta.title = this.meta._title
      this.meta.description = this.meta._description
      this.autosave()
    },

    /**
     * Go to next bookmark
     */
    nextBookmark () {
      const bookmarks = this.getSortedBookmarks()
      
      // Wrap value
      let index = this.currentBookmark + 1
      if (index > bookmarks.length - 1) index = 0
      this.currentBookmark = index
      
      this.$refs.workspace.blockly.centerOnBlock(bookmarks[this.currentBookmark].id)
    },

    /**
     * Go to previous bookmark
     */
    prevBookmark () {
      const bookmarks = this.getSortedBookmarks()
      
      // Wrap value
      let index = this.currentBookmark - 1
      if (index < 0) index = bookmarks.length - 1
      this.currentBookmark = index
      
      this.$refs.workspace.blockly.centerOnBlock(bookmarks[this.currentBookmark].id)
    },

    /**
     * Navigates to the bookmark if it exists
     * @param {Event} ev
     */
    onNumberKeypress (ev) {
      const bookmarks = this.getSortedBookmarks()
      const key = +ev.key || 10
      
      if (key <= bookmarks.length) {
        this.$refs.workspace.blockly.centerOnBlock(bookmarks[key - 1].id)
        this.currentBookmark = key - 1
      }
    },

    /**
     * Returns a list of bookmarks, sorted by their $index
     * @return {Array} Sorted list of bookmark blocks
     */
    getSortedBookmarks () {
      return sortBy(this.$refs.workspace.blockly.getBlocksByType('bookmark'), [bookmark => bookmark.getFieldValue('index')])
    },
    
    /**
     * Handles Workspace events
     */
    workspaceEventHandler (ev) {
      switch (ev.type) {
        case Blockly.Events.FINISHED_LOADING:
          this.hasLoaded = true
        break
          
        case Blockly.Events.BLOCK_CREATE:
        case Blockly.Events.BLOCK_DELETE:
        case Blockly.Events.BLOCK_CHANGE:
        case Blockly.Events.BLOCK_MOVE:
        case Blockly.Events.VAR_CREATE:
        case Blockly.Events.VAR_DELETE:
        case Blockly.Events.VAR_RENAME:
          this.$refs.workspace.run()
          this.checkBookmarks()
          this.hasLoaded && this.autosave()
        break
      }
    },

    /**
     * Checks if there are bookmarks and toggles the pagers
     */
    checkBookmarks () {
      const bookmarks = this.$refs.workspace.blockly.getBlocksByType('bookmark')
      this.$store.commit('set', ['studio.hasBookmarks', !!bookmarks.length])
    },

    /**
     * Gets an organized Blockly toolbox JSON, which consists of core blocks and custom blocks
     */
    getToolbox () {
      const categories = cloneDeep(toolbox)
      const customBlocks = store.get('blocks', {})

      // Map categories to indexes
      const coreBlockCats = categories.map(block => {
        return block.category || ''
      })

      // Add custom block to appropriate category
      Object.keys(customBlocks).forEach(id => {
        const customBlock = customBlocks[id]
        const catIndex = coreBlockCats.indexOf(customBlock.category)

        if (categories[catIndex]) {
          categories[catIndex].children.push({
            tag: 'block',
            type: customBlock.json.type
          })

          // Create block...
          Blockly.Blocks[customBlock.json.type] = {
            init: function() {
              this.jsonInit(customBlock.json)
            }
          }
          // ...and generator
          Blockly.JavaScript[customBlock.json.type] = function (block) {
            let code = []

            customBlock.variables.forEach(variable => {
              // Fields
              if (variable.type === 'field') {
                switch (variable.field) {
                  case 'variable':
                    code.push(`var $${variable.name} = ${JSON.stringify(Blockly.JavaScript.variableDB_.getName(block.getFieldValue(variable.name), Blockly.Variables.NAME_TYPE))}`)
                  break
                  case 'angle':
                    code.push(`var $${variable.name} = ${block.getFieldValue(variable.name)}`)
                  break
                  case 'colour':
                    code.push(`var $${variable.name} = ${JSON.stringify(block.getFieldValue(variable.name))}`)
                  break
                  case 'checkbox':
                    code.push(`var $${variable.name} = ${block.getFieldValue(variable.name) === 'TRUE' ? 'true' : 'false'}`)
                  break
                  case 'dropdown':
                    code.push(`var $${variable.name} = ${JSON.stringify(block.getFieldValue(variable.name))}`)
                  break
                  case 'number':
                    code.push(`var $${variable.name} = ${block.getFieldValue(variable.name)}`)
                  break
                  case 'text':
                    code.push(`var $${variable.name} = ${JSON.stringify(block.getFieldValue(variable.name))}`)
                  break
                }
              // Inputs
              } else {
                switch (variable.input) {
                  case 'value':
                    code.push(`var $${variable.name} = ${JSON.stringify(Blockly.JavaScript.valueToCode(block, variable.name, Blockly.JavaScript.ORDER_ATOMIC))}`)
                  break
                  case 'statements':
                    const statement = Blockly.JavaScript.statementToCode(block, variable.name)
                    code.push(`var $${variable.name} = function () {\n${statement}\n}`)
                  break
                }
              }
            })
            
            code = code.join(';\n')
            code += ';\n' + (customBlock.code || '')

            // Return code
            if (block.outputConnection) {
              return [code, Blockly.JavaScript.ORDER_NONE]
            } else {
              return code
            }
          }
        }
      })

      return categories
    },

    /**
     * Runs the code (if isPlaying)
     */
    triggerEvent (eventName, ev) {
      // Run the code
      let data = Object.assign({}, ev)
      data.target = Object.assign({}, data.target)
      delete data.target._diffInput
      delete data.target._userHandlers
      delete data.target.lastMessage
      data = JSON.stringify(data)
      
      this.$refs.workspace.interpreter.appendCode(`triggerEvent('${eventName}', '${data}')`)
      this.$refs.workspace.interpreter.run()

      // Update device message
      let diffName
      let diffData
      switch (eventName) {
        case 'noteon':
        case 'noteoff':
          diffName = `[${ev.note.number}, ${ev.note.name}, ${ev.note.octave}]`
          break;

        case 'controlchange':
          diffName = `[${ev.controller.number}, ${ev.controller.name}]`
          break;
      }
      
      this.$store.commit('set', [
        `devices.inputs['${ev.target.id}'].lastMessage`,
        `<div>
          <strong>${eventName}</strong>:
          <span>${diffName}</span>
        </div>
        <div>
          <strong>data</strong>:
          <span>[${ev.data[0]}, ${ev.data[1]}, ${ev.data[2]}]</span>
        </div>`])
    }
  }
}
</script>
