<template lang="pug">
.flex.min-height-inherit
  .min-height-inherit.position-relative.workspace-toolbox(
    :class='{blocklyToolboxDelete: !!blockBeingDragged}'
    v-if='!inline' style='flex: 0 0 auto'
    @mouseenter='isMouseInQuasarToolbox = true'
    @mouseleave='isMouseInQuasarToolbox = false')

    //- Quasar Toolbox
    .q-pa-sm.flex.column
      q-list
        template(v-for='category in toolbox')
          q-separator(v-if='category.tag === "sep"')
          q-item(v-else clickable :style='"color:" + category.colour' @click='showToolboxFlyout(category, $event)' :active='isFlyoutOpen && isFlyoutOpen === category.name')
            q-item-section(avatar)
              q-icon(:style='"color:" + category.colour' :name='category.icon')
            q-item-section.gt-sm
              q-item-label(:style='"color:" + category.colour') {{category.name}}
      q-list(style='flex: 0 0 auto')
        slot

  .min-height-inherit.position-relative(@click='closeToolboxFLyout')
    .blockly(style='min-height: inherit' :class='{"blockly-inline": inline}')
      //- Blockly
      .blockly-wrap(ref='blockly')
      //- Hidden Blockly Toolbox
      xml(ref='toolbox' style='display: none')
        template(v-for='category in toolbox')
          component(:is='category.tag' :name='category.name' :colour='category.colour' :custom='category.custom')
            template(v-for='block in category.children')
              component(:is='block.tag' :type='block.type' :colour='block.colour')
                template(v-for='blockProp in block.children')
                  component(:is='blockProp.tag' :id='blockProp.id' :op='blockProp.op' :at='blockProp.at' :items='blockProp.items' :statement='blockProp.statement' :mode='blockProp.mode' :at1='blockProp.at1' :at2='blockProp.at2' :divisor_input='blockProp.divisor_input' :name='blockProp.name' :colour='blockProp.colour') {{blockProp.value}}
                    template(v-for='blockShadow in blockProp.children')
                      component(:is='blockShadow.tag' :type='blockShadow.type' :name='blockShadow.name') {{blockShadow.value}}
                        template(v-for='blockShadowProp in blockShadow.children')
                          component(:is='blockShadowProp.tag' :name='blockShadowProp.name') {{blockShadowProp.value}}
</template>

<script>
import Blockly from 'blockly'
import {mapState} from 'vuex'
import STRING_WebmidiInterpreter from '!!raw-loader!!../assets/js/webmidi-interpreter.js'
import webmidi from 'webmidi'
import {defaults} from 'lodash'
import Interpreter from 'js-interpreter'
import midiblocksTheme from '../assets/toolboxes/theme'
import * as Babel from '@babel/standalone'

/**
 * @emits onChange
 */
export default {
  name: 'Blockly',
  props: ['options', 'toolbox', 'blocks', 'inline'],

  computed: {
    ...mapState(['devices'])
  },

  data () {
    return {
      blockly: null,
      interpreter: null,
      isFlyoutOpen: false,
      blockBeingDragged: false,

      // Useful for re-showing a category toolbox (eg, after creating a variable)
      lastClickedCategory: null,
      isMouseInQuasarToolbox: false
    }
  },

  /**
   * Initialize Blockly and setup event listeners
   */
  mounted () {
    let options = this.$props.options || {}
    options = defaults(this.$props.options, {
      renderer: 'zelos',
      sounds: false,
      toolbox: this.$refs.toolbox,
      media: 'media/',
      zoom: {
        controls: true,
        pinch: true,
        wheel: true,
        startScale: 0.8
      },
      grid: {
        spacing: 50,
        length: 50,
        colour: '#9effff',
        snap: true
      },
      theme: midiblocksTheme
    })

    // Create workspace and add bindings
    this.blockly = Blockly.inject(this.$refs.blockly, options)
    this.blockly.addChangeListener(this.onChange)
    this.$root.$on('blockly.prompt.submit', this.onPromptSubmit)

    // Add blocks
    this.addBlocks()
  },

  beforeDestroy () {
    this.$root.$off('blockly.prompt.submit', this.onPromptSubmit)
  },

  methods: {
    /**
     * Called when something happens from within Blockly
     * @see https://developers.google.com/blockly/guides/configure/web/events
     * 
     * - Deletes block if released inside quasar toolbox
     */
    onChange (ev) {
      this.$emit('change', ev)

      if (ev.element === 'dragStart') {
        this.blockBeingDragged = ev
      } else if (ev.element === 'dragStop') {
        if (this.isMouseInQuasarToolbox) {
          this.blockly.getBlockById(ev.blockId).dispose()
        }
        this.blockBeingDragged = false
      }
    },

    /**
     * Open the flyout based on the clicked item
     */
    showToolboxFlyout (category, ev) {
      let nodes = []

      // Show flyout
      if (category.custom) {
        this.blockly.getFlyout().show(category.custom)        
      } else {
        category.children.forEach(block => {
          nodes.push(document.querySelector(`block[type="${block.type}"]`))
        })
        this.blockly.getFlyout().show(nodes)
      }

      this.isFlyoutOpen = category.name
      this.lastClickedCategory = ev.target
    },

    /**
     * Opens the last opened toolbox (good for showing a newly created variable)
     */
    onPromptSubmit (prompt) {
      this.lastClickedCategory && this.lastClickedCategory.click()
    },

    /**
     * Closes the toolbox
     */
    closeToolboxFLyout (ev) {
      // "prevent default" on flyout click so that it doesn't hide but the event still bubbles up
      let clickedInToolbox = ev.path.some($el => {
        return $el.classList && $el.classList.contains('blocklyFlyoutBackground')
      })

      if (this.isFlyoutOpen && !clickedInToolbox) {
        this.blockly.getFlyout().hide()
        this.isFlyoutOpen = false
      }
    },

    /**
     * Execute code
     */
    run () {
      const code = Blockly.JavaScript.workspaceToCode(this.blockly)
      this.interpreter = new Interpreter(
        Babel.transform(STRING_WebmidiInterpreter + '\n' + code, {
          presets: ['env'],
          sourceType: 'script'
        }).code, this.setupInterpreter)
      this.interpreter.run()
    },

    /**
     * Sets up the interpreter
     * @todo Move this into a module
     */
    setupInterpreter (acorn, globalObject) {
      /**
       * Console.log
       */
      acorn.setProperty(globalObject, 'log', acorn.createNativeFunction((dataStr) => {
        console.log('📦 log: ', ...JSON.parse(dataStr))
      }))

      /**
       * Play a midi sound
       */
      acorn.setProperty(globalObject, '_playNote', acorn.createNativeFunction((dataStr) => {
        let data = JSON.parse(dataStr)
        
        if (data.device === 'all') {
          Object.keys(this.devices.outputs).forEach(key => {
            const output = webmidi.getOutputById(key)
            output.playNote(data.note, data.channel)
          })
        }
      }))
    },

    /**
     * Adds blocks to the workspace
     */
    addBlocks () {
      this.blocks.forEach(block => {
        Blockly.Blocks[block.title] = {
          init: function () {
            this.jsonInit(JSON.parse(block.block_definition))
          }
        }
        Blockly.JavaScript[block.title] = () => ''

        // Inject into workspace
        const theBlock = this.blockly.newBlock(block.title)
        theBlock.initSvg()
        theBlock.render()

        // Center the block
        this.blockly.centerOnBlock(theBlock.id)
        this.blockly.scroll(this.blockly.scrollX, this.blockly.scrollY)
      })
    }
  }
}
</script>

<style lang="sass">
@import '../css/quasar.variables.sass'

.workspace-toolbox
  background: $dark

  .q-item--active .q-focus-helper
    background: currentColor
    opacity: .25

  @media (max-width: 1023px)
    .q-item__section--avatar
      padding-right: 0
      min-width: 0
</style>