const stylesHtml = `
<style>
.cac-alert-container {
  display: flex;
  flex-direction: column;
  gap: 0px; /* Adds space between the alerts */
}
.cac-alert-container.with-alerts {
    gap: 1px; /* Adds space between the alerts */
  }

.cac-custom-alert {
  display: flex;
  align-items: center;
  justify-content: space-between; /* Add this line */
  padding: 10px;
  background-color: #cce5ff; /* Light blue background */
  color: #004085; /* Dark blue text color */
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); /* Subtle shadow */
  font-family: "Roboto", sans-serif;
  margin-bottom: 2px; /* Spacing between each alert */
}


.cac-icon-wrapper {
  display: inline-block;
  margin-right: 8px; /* Adjust the space between the icon and the text */
  height: 18px; /* Adjust the icon size */
  width: 18px; /* Adjust the icon size */
  vertical-align: middle; /* Center align the icon vertically */
  transform: translateY(-2px); /* Move the icon up by 2 pixels */
}

.cac-icon-wrapper ha-icon {
  height: 100%;
  width: 100%;
}
.cac-last-complete {
  float: right;
  font-size: 9px;
}
</style>
`;
class ChorzyAlertCard extends HTMLElement {
    constructor() {
        super();
        this.config = {}; // Store the configuration
        this.processedConfig = {}; // Store the processed configuration
        this.previousEntityStates = {};
    }
    set hass(hass) {
        if (!this.content) {
            this.initializeContent();
        }

        if (hass) {
            console.log({hass})
            this.processConfig(hass);
        } else {
            console.log("no hass, wait for next update")
        }


        if (this.hasEntitiesStateChanged(hass)) {
            this.updateContent(hass);
        }
    }

    initializeContent() {
        this.content = document.createElement('div');
        this.content.classList.add('cac-alert-container');
        this.appendChild(this.content);
        this.previousEntityStates = {};
    }


    setConfig(config) {
        if (!config.entities || !Array.isArray(config.entities)) {
            throw new Error("Invalid configuration");
        }
        this.config = config;
    }
    processConfig(hass) {
        this.processedConfig = {
            entities: [],
            defaultColor: 'orange',
            defaultTextColor: 'black',
            defaultState: 'on',
            defaultIcon: 'mdi:alert-decagram-outline'
        };

        //copy the object cause we cannot edit this.config
        let config = JSON.parse(JSON.stringify(this.config));

        //Check for and set defaults
        if (config.defaultState) this.processedConfig.defaultState = config.defaultState;
        if (config.defaultColor) this.processedConfig.defaultColor = config.defaultColor;
        if (config.defaultTextColor) this.processedConfig.defaultTextColor = config.defaultTextColor;
        if (config.defaultIcon) this.processedConfig.defaultIcon = config.defaultIcon;



        config.entities.forEach(configItem => {
            if (configItem.entityId.includes('*')) {
                // Handle wildcard entities
                const regex = new RegExp('^' + configItem.entityId.replace(/\*/g, '.*') + '$');
                const matchedEntities = Object.keys(hass.states).filter(entityId => regex.test(entityId));
                matchedEntities.forEach(matchedEntityId => {
                    this.processedConfig.entities.push({ ...configItem, entityId: matchedEntityId });
                });

            } else {
                // Handle normal entities
                this.processedConfig.entities.push(configItem);

            }

        });
        console.log("done processing", this.processedConfig)

    }


    hasEntitiesStateChanged(hass) {
        let stateChanged = false;

        this.processedConfig.entities.forEach((configItem) => {
            const entityId = configItem.entityId;
            const newState = hass.states[entityId];
            const oldState = this.previousEntityStates[entityId];

            if (!oldState || newState.state !== oldState.state) {
                stateChanged = true;
            }

            this.previousEntityStates[entityId] = newState;
        });

        return stateChanged;
    }

    updateContent(hass) {
        const chores = this.processedConfig.entities
            .filter((configItem) => {
                const entity = hass.states[configItem.entityId];
                // Use the specific state for the entity if available, otherwise fall back to the default state
                const desiredState = configItem.state || this.processedConfig.defaultState;

                return entity && entity.state === desiredState;
            })
            .map(configItem => ({
                ...hass.states[configItem.entityId],
                customText: configItem.customText,
                customName: configItem.customName || hass.states[configItem.entityId].attributes.friendly_name,
                color: configItem.color, // Include the color in the mapped object
                icon: configItem.icon, // Include the icon in the mapped object
                textColor: configItem.textColor // Include the text color in the mapped object
            }));

        let alertsHtml = chores.map(chore => {
            let text = chore.customText || `Chore: <name> was due ${chore.attributes.day_due}!`;
            if (chore.customName && text.includes('<name>')) {
                text = text.replace('<name>', chore.customName);
            } else if (!chore.customName) {
                text = text.replace('<name>', chore.attributes.friendly_name);
            }

            // Use the specific color for the alert if available, otherwise fall back to the default color
            let alertStyle = `background-color: ${chore.color || this.processedConfig.defaultColor};`;
            let icon = chore.icon || this.processedConfig.defaultIcon;
            let textStyle = `color: ${chore.textColor || this.processedConfig.defaultTextColor};`; // Add this line for text color

            return `
                <div class="cac-custom-alert alert-info" style="${alertStyle}">
                  <div style="${textStyle}">  <!-- Apply textStyle here -->
                    <span class="cac-icon-wrapper">${this.getIcon(icon)}</span>
                    <span>${text}</span>
                  </div>
                </div>
            `;
        }).join('');

        this.content.innerHTML = alertsHtml;
        this.content.innerHTML += this.getCommonStyles();

        if (chores.length > 0) {
            this.content.classList.add('with-alerts');
          } else {
            this.content.classList.remove('with-alerts');
          }
    }
    getIcon(icon) {
        return `<ha-icon icon="${icon}"></ha-icon>`;
    }

    // getIcon() {
    //     return `<svg width="100" height="100" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    //     <circle cx="12" cy="12" r="10" fill="#007bff" stroke="#004085" stroke-width="2"/>
    //     <text x="12" y="14" font-family="Arial" font-size="12" fill="white" text-anchor="middle" dominant-baseline="middle">i</text>
    // </svg>`
    // }
    getCommonStyles() {
        return stylesHtml;
    }
    getCardSize() {
        return 2; // Adjust as necessary for your card's content
    }

}

customElements.define('chorzy-alert-card', ChorzyAlertCard);