class TractUI {
  constructor() {

    this.snappingDistanceThreshold = 0.3;
    this._constrictions = new Map();
    this.initializeVowelPositions();

    // Initialize gamepad state
    this.gamepadIndex = null;
    this.isGamepadActive = false;
    this.lastTonguePosition = { index: 22, diameter: 2 };

    this.forceControl = window.forceControl;
    this.lastUpdate = performance.now();
    this.updateInterval = 16;

    this.leftStickX = 0;
    this.leftStickY = 0;
    this._container = document.createElement("div");
    this._container.style.margin = 0;
    this._container.style.padding = 0;

    this._canvases = {};
    this._contexts = {};

    ["tract", "background"].forEach((id, index) => {
      const canvas = document.createElement("canvas");
      canvas.id = id;

      canvas.style.position = "absolute";
      canvas.height = 500;
      canvas.width = 600;
      canvas.style.backgroundColor = "transparent";
      canvas.style.margin = 0;
      canvas.style.padding = 0;
      canvas.style.zIndex = 1 - index;

      this._canvases[id] = canvas;
      this._contexts[id] = canvas.getContext("2d");

      this._container.appendChild(canvas);
    });

    this._canvas = this._canvases.tract;
    this._context = this._contexts.tract;

    this._tract = {
      origin: {
        x: 340,
        y: 460,
      },

      radius: 298,
      scale: 60,

      scalar: 1,

      angle: {
        scale: 0.64,
        offset: -0.25,
      },
    };
    this._processor = null;
    this._parameters = {};

    this._touchConstrictionIndices = [];

    // Listen for gamepad events
    window.addEventListener("gamepadconnected", (event) => {
      this.gamepadIndex = event.gamepad.index;
      this.isGamepadActive = true;
      this.updateGamepadState();
    });

    window.addEventListener("gamepaddisconnected", () => {
      this.isGamepadActive = false;
      this.gamepadIndex = null;
    });

    // AnimationFrame
    this._container.addEventListener("animationFrame", (event) => {
      this._container.dispatchEvent(
        new CustomEvent("getProcessor", {
          bubbles: true,
        })
      );

      this._container.dispatchEvent(
        new CustomEvent("getParameter", {
          bubbles: true,
          detail: {
            parameterName: "intensity",
          },
        })
      );
    });

    this._container.addEventListener("didGetProcessor", (event) => {
      this._processor = event.detail.processor;
      this._resize();
      this._drawTract();
    });
    this._container.addEventListener("didGetParameter", (event) => {
      const parameterName = event.detail.parameterName;
      const value = event.detail.value;

      this._parameters[parameterName] = value;
    });

    // RequestAnimationFrame after being attached to the DOM
    const mutationObserver = new MutationObserver((mutationsList, observer) => {
      if (document.contains(this._container)) {
        this._container.dispatchEvent(
          new CustomEvent("requestAnimationFrame", {
            bubbles: true,
          })
        );

        observer.disconnect();
      }
    });
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
    });

    // Mouse EventListeners
    this._canvases.tract.addEventListener("mousedown", (event) => {
      this._startEvent(event);
    });
    this._canvases.tract.addEventListener("mousemove", (event) => {
      this._moveEvent(event);
    });
    this._canvases.tract.addEventListener("mouseup", (event) => {
      this._endEvent(event);
    });

    // Touch EventListeners
    this._canvases.tract.addEventListener("touchstart", (event) => {
      event.preventDefault();
      Array.from(event.changedTouches).forEach((touch) =>
        this._startEvent(touch)
      );
    });
    this._canvases.tract.addEventListener("touchmove", (event) => {
      event.preventDefault();
      Array.from(event.changedTouches).forEach((touch) =>
        this._moveEvent(touch)
      );
    });
    this._canvases.tract.addEventListener("touchend", (event) => {
      event.preventDefault();
      Array.from(event.changedTouches).forEach((touch) =>
        this._endEvent(touch)
      );
    });
    this._canvases.tract.addEventListener("touchcancel", (event) => {
      event.preventDefault();
      Array.from(event.changedTouches).forEach((touch) =>
        this._endEvent(touch)
      );
    });

    // Constriction EventLiteners
    this._canvases.tract.addEventListener("didNewConstriction", (event) => {
      this._touchConstrictionIndices[event.detail.touchIdentifier] =
        event.detail.constrictionIndex;
    });
    this._canvases.tract.addEventListener("didRemoveConstriction", (event) => {
      this._touchConstrictionIndices[event.detail.touchIdentifier] = undefined;
    });
  }

  initializeVowelPositions() {
    this.vowelPositions = [
      { angle: 15, radius: 0.6 * 1.5 + 2, phoneme: "æ" }, // pat
      { angle: 13, radius: 0.27 * 1.5 + 2, phoneme: "a" }, // part
      { angle: 12, radius: 0 * 1.5 + 2, phoneme: "ɒ" }, // pot
      { angle: 17.7, radius: 0.05 * 1.5 + 2, phoneme: "(ɔ)" }, // port (rounded)
      { angle: 27, radius: 0.65 * 1.5 + 2, phoneme: "ɪ" }, // pit
      { angle: 27.4, radius: 0.21 * 1.5 + 2, phoneme: "i" }, // peat
      { angle: 20, radius: 1.0 * 1.5 + 2, phoneme: "e" }, // pet
      { angle: 18.1, radius: 0.37 * 1.5 + 2, phoneme: "ʌ" }, // putt
      { angle: 23, radius: 0.1 * 1.5 + 2, phoneme: "(u)" }, // poot (rounded)
      { angle: 21, radius: 0.6 * 1.5 + 2, phoneme: "ə" }  // pert [should be ɜ]
    ];
  }

  updateGamepadState() {
    if (!this.isGamepadActive || this.gamepadIndex === null) return;

    const gamepad = navigator.getGamepads()[this.gamepadIndex];
    if (!gamepad) {
      requestAnimationFrame(() => this.updateGamepadState());
      return;
    }

    // Limit the update rate to the specified interval
    const now = performance.now();
    if (now - this.lastUpdate < this.updateInterval) {
      requestAnimationFrame(() => this.updateGamepadState());
      return;
    }
    this.lastUpdate = now;

    // Check the global forceControl variable to decide which method to call
    if (this.forceControl !== window.forceControl) {
      this.forceControl = window.forceControl;
    };

    if (this.forceControl) {
      this.updateGamepadState1(gamepad);
    } else {
      this.updateGamepadState2(gamepad);
    }

    requestAnimationFrame(() => this.updateGamepadState());
  }

  updateGamepadState1(gamepad) {

    const leftStickX = gamepad.axes[0] || 0;
    const leftStickY = gamepad.axes[1] || 0;

    const deadzone = 0.11;
    const velocityFactor = 0.01;
    const distances = this._isNearTongue(angle, radius);
    const closeEnoughThreshold = 0.1;  // Define a threshold for snapping
    const isCloseToVowel = distances.some(d => d.distance < closeEnoughThreshold);

    // Check if the joystick is within the deadzone
    const isWithinDeadzone = Math.abs(leftStickX) < deadzone && Math.abs(leftStickY) < deadzone;
    if (isWithinDeadzone) {
      requestAnimationFrame(() => this.updateGamepadState());
      return;
    }

    if (isCloseToVowel) {
      // Snap to vowel based on proximity and weights
      const weightedPositions = this._softmax(distances);
      let weightedIndex = 0;
      let weightedDiameter = 0;
      weightedPositions.forEach(pos => {
        weightedIndex += pos.index * pos.weight;
        weightedDiameter += pos.diameter * pos.weight;
      });

      // Update the processor's tract tongue parameters
      this._processor.tract.tongue.index = weightedIndex;
      this._processor.tract.tongue.diameter = weightedDiameter;
    } else {
      // Apply joystick movements to tongue position directly if not snapping
      this.lastTonguePosition.index += leftStickX * velocityFactor * 44; // Assuming tract length is 44
      this.lastTonguePosition.diameter += leftStickY * velocityFactor * 4; // Assuming max diameter is 4

      // Clamp values to ensure they remain within valid ranges
      this.lastTonguePosition.index = Math.clamp(this.lastTonguePosition.index, 0, 44);
      this.lastTonguePosition.diameter = Math.clamp(this.lastTonguePosition.diameter, 0, 4);
    }

    const interpolationLeft = {
      index: this.lastTonguePosition.index,
      diameter: this.lastTonguePosition.diameter,
      radius: Math.sqrt(leftStickX * leftStickX + leftStickY * leftStickY), // Calculate radius
      angle: Math.atan2(leftStickY, leftStickX) // Calculate angle in radians
    };

    this._container.dispatchEvent(new CustomEvent("gamepadInputTract", {
      bubbles: true,
      detail: interpolationLeft,
    }));

    requestAnimationFrame(() => this.updateGamepadState());
  }

  updateGamepadState2(gamepad) {

    const leftStickX = gamepad.axes[0] || 0;
    const leftStickY = gamepad.axes[1] || 0;

    const interpolationLeft = {
      index: Math.clamp(Math.pow((leftStickX + 1) / 2, 2) * 44, 0, 44),
      diameter: Math.clamp((leftStickY + 1) / 2 * 4, 0, 4),
      radius: Math.sqrt(leftStickX * leftStickX + leftStickY * leftStickY), // Calculate radius
      angle: Math.atan2(leftStickY, leftStickX) // Calculate angle in radians
    };

    // Store last tongue position when set via gamepad
    this.lastTonguePosition = interpolationLeft;

    this._container.dispatchEvent(new CustomEvent("gamepadInputTract", {
      bubbles: true,
      detail: interpolationLeft,
    }));

    requestAnimationFrame(() => this.updateGamepadState());
  }

  _isNearTongue(angle, radius) {
    const distances = [];
    for (const vowelPos of this.vowelPositions) {
      const angleDifference = Math.abs(vowelPos.angle - angle);
      const radiusDifference = Math.abs(vowelPos.radius - radius);
      const distance = Math.sqrt(angleDifference * angleDifference + radiusDifference * radiusDifference);
      distances.push({ distance, index: vowelPos.index, diameter: vowelPos.diameter });
    }
    return distances;
  }

  _softmax(distances) {
    const scale = 20; // Scale factor for controlling the sharpness of the softmax
    const exps = distances.map(d => Math.exp(-scale * d.distance));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    return distances.map((d, i) => ({ ...d, weight: exps[i] / sumExps }));
  }

  _setTongue(event, angle, radius) {
    // Calculate distances to each vowel position
    const distances = this._isNearTongue(angle, radius);

    // Apply softmax to these distances to determine weights
    const weightedPositions = this._softmax(distances);

    // Compute the weighted average position based on softmax outputs
    let weightedIndex = 0;
    let weightedDiameter = 0;
    weightedPositions.forEach(pos => {
      weightedIndex += pos.index * pos.weight;
      weightedDiameter += pos.diameter * pos.weight;
    });

    // Create a position object with the computed weighted average index and diameter
    const newPosition = {
      index: weightedIndex,
      diameter: weightedDiameter
    };

    // Update the processor's tract tongue parameters
    this._processor.tract.tongue.index = newPosition.index;
    this._processor.tract.tongue.diameter = newPosition.diameter;

    // Dispatch the setParameterTract event for each parameter
    Object.keys(newPosition).forEach(parameterNameSuffix => {
      event.target.dispatchEvent(new CustomEvent("setParameterTract", {
        bubbles: true,
        detail: {
          parameterName: "tongue." + parameterNameSuffix,
          newValue: newPosition[parameterNameSuffix],
        },
      }));
    });

    this._drawTract();
  }

  _startEvent(event) {
    const touchIdentifier = event instanceof Touch ? event.identifier : -1;
    if (this._touchConstrictionIndices[touchIdentifier] == undefined) {
      const position = this._getEventPosition(event);
      const isNearTongue = this._isNearTongue(position.index, position.diameter);
      if (isNearTongue) {
        this._touchConstrictionIndices[touchIdentifier] = -1;
        // Set tongue position only if not set via gamepad
        if (!this.isGamepadActive) {
          this._setTongue(event, position);
        }
      } else {
        event.target.dispatchEvent(
          new CustomEvent("newConstriction", {
            bubbles: true,
            detail: {
              touchIdentifier: touchIdentifier,
              index: position.index,
              diameter: position.diameter,
            },
          })
        );
      }
    }
  }

  _moveEvent(event) {
    const touchIdentifier = event instanceof Touch ? event.identifier : -1;

    if (this._touchConstrictionIndices[touchIdentifier] !== undefined) {
      const position = this._getEventPosition(event);
      const constrictionIndex = this._touchConstrictionIndices[touchIdentifier];
      const isTongue = constrictionIndex == -1;

      if (isTongue) {
        // Update tongue position only if not set via gamepad
        if (!this.isGamepadActive) {
          this._setTongue(event, position);

        }
      } else {
        event.target.dispatchEvent(
          new CustomEvent("setConstriction", {
            bubbles: true,
            detail: {
              touchIdentifier: touchIdentifier,
              index: position.index,
              diameter: position.diameter,
            },
          })
        );
      }
    }
  }

  _endEvent(event) {
    const touchIdentifier = event instanceof Touch ? event.identifier : -1;
    if (this._touchConstrictionIndices[touchIdentifier] !== undefined) {
      if (this._touchConstrictionIndices[touchIdentifier] === -1) {
        // End tongue constriction
        this._touchConstrictionIndices[touchIdentifier] = undefined;
      } else {
        // End regular constriction
        this._constrictions.delete(touchIdentifier);
        this._endConstriction(event);
        event.target.dispatchEvent(
          new CustomEvent("removeConstriction", {
            bubbles: true,
            detail: {
              touchIdentifier: touchIdentifier,
            },
          })
        );
      }
    }
  }

  _startConstriction(event) {
    // Extract touch information and start constriction
    const touchIdentifier = event instanceof Touch ? event.identifier : -1;
    const position = this._getEventPosition(event);

    if (this._constrictions.has(touchIdentifier)) {
      // Handle starting of a new constriction
      const constrictionData = this._constrictions.get(touchIdentifier);
    }
  }

  _moveConstriction(event) {
    // Extract touch information and update constriction
    const touchIdentifier = event instanceof Touch ? event.identifier : -1;
    const position = this._getEventPosition(event);

    if (this._constrictions.has(touchIdentifier)) {
      // Handle updating of constriction
      const constrictionData = this._constrictions.get(touchIdentifier);
      constrictionData.index = position.index;
      constrictionData.diameter = position.diameter;
    }
  }

  _endConstriction(event) {
    // Extract touch information and end constriction
    const touchIdentifier = event instanceof Touch ? event.identifier : -1;

    if (this._constrictions.has(touchIdentifier)) {
      // Handle ending of constriction
      this._constrictions.delete(touchIdentifier);
    }
  }

  get node() {
    return this._container;
  }

  get width() {
    return this._container.offsetWidth;
  }
  get height() {
    return this._container.offsetHeight;
  }

  _resize() {
    this._tract.scalar =
      this._canvases.tract.width / this._canvases.tract.offsetWidth;
    this._resizeCanvases();
  }

  _resizeCanvases() {
    for (let id in this._canvases) {
      this._canvases[id].style.height = this._container.offsetHeight;
    }
  }

  _drawTract() {
    if (this._isDrawing) return;

    this._isDrawing = true;

    this._context = this._contexts.tract;

    this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
    this._context.lineCap = this._context.lineJoin = "round";

    this._drawTongueControl();

    this._context.beginPath();
    this._context.lineWidth = 2;
    this._context.strokeStyle = this._context.fillStyle = "pink";
    this._moveTo(1, 0);

    for (let index = 1; index < this._processor.tract.length; index++)
      this._lineTo(index, this._processor.tract.diameter[index]);

    for (let index = this._processor.tract.length - 1; index >= 2; index--)
      this._lineTo(index, 0);

    this._context.closePath();
    this._context.stroke();
    this._context.fill();

    // NOSE
    const velum = this._processor.tract.nose.diameter[0];
    const velumAngle = velum * 4;

    this._context.beginPath();
    this._context.lineWidth = 2;
    this._context.strokeStyle = this._context.fillStyle = "pink";
    this._moveTo(
      this._processor.tract.nose.start,
      -this._processor.tract.nose.offset
    );

    for (let index = 1; index < this._processor.tract.nose.length; index++)
      this._lineTo(
        index + this._processor.tract.nose.start,
        -this._processor.tract.nose.offset -
        this._processor.tract.nose.diameter[index] * 0.9
      );

    for (let index = this._processor.tract.nose.length - 1; index >= 1; index--)
      this._lineTo(
        index + this._processor.tract.nose.start,
        -this._processor.tract.nose.offset
      );

    this._context.closePath();
    this._context.fill();

    this._context.beginPath();
    this._context.lineWidth = 2;
    this._context.strokeStyle = this._context.fillStyle = "pink";
    this._moveTo(this._processor.tract.nose.start - 2, 0);
    this._lineTo(
      this._processor.tract.nose.start,
      -this._processor.tract.nose.offset
    );
    this._lineTo(
      this._processor.tract.nose.start + velumAngle,
      -this._processor.tract.nose.offset
    );
    this._lineTo(this._processor.tract.nose.start + velumAngle - 2, 0);
    this._context.closePath();
    this._context.stroke();
    this._context.fill();

    this._context.fillStyle = "white";
    this._context.font = "20px Arial";
    this._context.textAlign = "center";
    this._context.globalAlpha = 1;

    this._drawText(
      this._processor.tract.length * 0.1,
      0.425,
      "throat",
      false,
      false
    );
    this._drawText(
      this._processor.tract.length * 0.71,
      -1.8,
      "nasal",
      false,
      false
    );
    this._drawText(
      this._processor.tract.length * 0.71,
      -1.3,
      "cavity",
      false,
      false
    );

    this._context.font = "22px Arial";
    this._drawText(
      this._processor.tract.length * 0.6,
      0.9,
      "oral",
      false,
      false
    );
    this._drawText(
      this._processor.tract.length * 0.7,
      0.9,
      "cavity",
      false,
      false
    );

    this._drawAmplitudes();

    this._context.beginPath();
    this._context.lineWidth = 5;
    this._context.strokeStyle = "#C070C6";
    this._context.lineJoin = this._context.lineCap = "round";
    this._moveTo(1, this._processor.tract.diameter[0]);
    for (let index = 2; index < this._processor.tract.length; index++)
      this._lineTo(index, this._processor.tract.diameter[index]);

    this._moveTo(1, 0);
    for (let index = 2; index <= this._processor.tract.nose.start - 2; index++)
      this._lineTo(index, 0);

    this._moveTo(this._processor.tract.nose.start + velumAngle - 2, 0);
    for (
      let index = this._processor.tract.nose.start + Math.ceil(velumAngle) - 2;
      index < this._processor.tract.length;
      index++
    )
      this._lineTo(index, 0);

    this._context.stroke();

    this._context.beginPath();
    this._context.lineWidth = 5;
    this._context.strokeStyle = "#C070C6";
    this._context.lineJoin = "round";

    this._moveTo(
      this._processor.tract.nose.start,
      -this._processor.tract.nose.offset
    );
    for (let index = 1; index < this._processor.tract.nose.length; index++)
      this._lineTo(
        index + this._processor.tract.nose.start,
        -this._processor.tract.nose.offset -
        this._processor.tract.nose.diameter[index] * 0.9
      );

    this._moveTo(
      this._processor.tract.nose.start + velumAngle,
      -this._processor.tract.nose.offset
    );
    for (
      let index = Math.ceil(velumAngle);
      index < this._processor.tract.nose.length;
      index++
    )
      this._lineTo(
        index + this._processor.tract.nose.start,
        -this._processor.tract.nose.offset
      );

    this._context.stroke();

    this._context.globalAlpha = velum * 5;
    this._context.beginPath();
    this._moveTo(this._processor.tract.nose.start - 2, 0);
    this._lineTo(
      this._processor.tract.nose.start,
      -this._processor.tract.nose.offset
    );
    this._lineTo(
      this._processor.tract.nose.start + velumAngle,
      -this._processor.tract.nose.offset
    );
    this._lineTo(this._processor.tract.nose.start + velumAngle - 2, 0);
    this._context.stroke();

    this._context.fillStyle = "orchid";
    this._context.font = "20px Arial";
    this._context.textAlign = "center";
    this._context.globalAlpha = 0.7;
    this._drawText(
      this._processor.tract.length * 0.95,
      0.8 +
      0.8 * this._processor.tract.diameter[this._processor.tract.length - 1],
      " lip",
      false,
      false
    );

    this._context.globalAlpha = 1;
    this._context.fillStyle = "black";
    this._context.textAlign = "left";

    this._drawPositions();

    this._isDrawing = false;
  }

  _drawCircle(index, diameter, arcRadius) {
    const angle = this._getAngle(index);
    const radius = this._getRadius(index, diameter);

    this._context.beginPath();
    this._context.arc(
      this._getX(angle, radius),
      this._getY(angle, radius),
      arcRadius,
      0,
      2 * Math.PI
    );
    this._context.fill();
  }
  _drawTongueControl() {
    this._context.lineCap = this._context.lineJoin = "round";
    this._context.strokeStyle = this._context.fillStyle = "#FFEEF5"; // palePink
    this._context.globalAlpha = 1.0;
    this._context.beginPath();
    this._context.lineWidth = 45;

    this._moveTo(
      this._processor.tract.tongue.range.index.minValue,
      this._processor.tract.tongue.diameter.minValue
    );
    for (
      let index = this._processor.tract.tongue.range.index.minValue + 1;
      index <= this._processor.tract.tongue.range.maxValue;
      index++
    ) {
      this._lineTo(index, this._processor.tract.tongue.range.diameter.minValue);
    }
    this._lineTo(
      this._processor.tract.tongue.range.index.center,
      this._processor.tract.tongue.range.diameter.maxValue
    );
    this._context.closePath();
    this._context.stroke();
    this._context.fill();

    this._context.fillStyle = "orchid";
    this._context.globalAlpha = 0.3;

    [0, -4.25, -8.5, 4.25, 8.5, -6.1, 6.1, 0, 0].forEach(
      (indexOffset, _index) => {
        const diameter =
          _index < 5
            ? this._processor.tract.tongue.range.diameter.minValue
            : _index < 8
              ? this._processor.tract.tongue.range.diameter.center
              : this._processor.tract.tongue.range.diameter.maxValue;

        indexOffset *= this._processor.tract.length / 44;

        this._drawCircle(
          this._processor.tract.tongue.range.index.center + indexOffset,
          diameter,
          3
        );
      }
    );

    const tongueAngle = this._getAngle(this._processor.tract.tongue.index);
    const tongueRadius = this._getRadius(
      this._processor.tract.tongue.index,
      this._processor.tract.tongue.diameter
    );

    this._context.lineWidth = 4;
    this._context.strokeStyle = "orchid";
    this._context.globalAlpha = 0.7;
    this._context.beginPath();
    this._context.arc(
      this._getX(tongueAngle, tongueRadius),
      this._getY(tongueAngle, tongueRadius),
      18,
      0,
      2 * Math.PI
    );
    this._context.stroke();
    this._context.globalAlpha = 0.15;
    this._context.fill();
    this._context.globalAlpha = 1;
    this._context.fillStyle = "orchid";
  }
  _drawAmplitudes() {
    this._context.strokeStyle = "orchid";
    this._context.lineCap = "butt";
    this._context.globalAlpha = 0.3;

    for (let index = 2; index < this._processor.tract.length - 1; index++) {
      this._context.beginPath();
      this._context.lineWidth =
        Math.sqrt(this._processor.tract.amplitude.max[index]) * 3;

      this._moveTo(index, 0);
      this._lineTo(index, this._processor.tract.diameter[index]);

      this._context.stroke();
    }

    for (
      let index = 1;
      index < this._processor.tract.nose.length - 1;
      index++
    ) {
      this._context.beginPath();
      this._context.lineWidth =
        Math.sqrt(this._processor.tract.nose.amplitude.max[index]) * 3;

      this._moveTo(
        this._processor.tract.nose.start + index,
        -this._processor.tract.nose.offset
      );
      this._lineTo(
        this._processor.tract.nose.start + index,
        -this._processor.tract.nose.offset -
        this._processor.tract.nose.diameter[index] * 0.9
      );

      this._context.stroke();
    }

    this._context.globalAlpha = 1;
  }
  _drawPositions() {
    this._context.fillStyle = "orchid";
    this._context.font = "24px Arial";
    this._context.textAlign = "center";
    this._context.globalAlpha = 0.6;

    this.vowelPositions = [];

    [
      [15, 0.6, "æ"], // pat
      [13, 0.27, "a"], // part
      [12, 0, "ɒ"], // pot
      [17.7, 0.05, "(ɔ)"], // port (rounded)
      [27, 0.65, "ɪ"], // pit
      [27.4, 0.21, "i"], // peat
      [20, 1.0, "e"], // pet
      [18.1, 0.37, "ʌ"], // putt
      [23, 0.1, "(u)"], // poot (rounded)
      [21, 0.6, "ə"], // pert [should be ɜ]
    ].forEach((position) => {
      const angle = position[0];
      const radius = position[1] * 1.5 + 2;
      const phoneme = position[2];
      this._drawText(angle, radius, phoneme, false);
      this.vowelPositions.push({ angle, radius, phoneme });
    });

    this._context.globalAlpha = 0.8;

    const approximants = 1.1;
    this._drawText(38, approximants, "l", false);
    this._drawText(41, approximants, "w", false);

    this._drawText(4.5, 0.37, "h", false);

    // setting up phoneme stuff
    const phonemes =
      this._parameters.intensity > 0
        ? ["ʒ", "z", "v", "g", "d", "b"]
        : ["ʃ", "s", "f", "k", "t", "p"];
    phonemes.push("ŋ", "n", "m");

    const fricatives = 0.3;
    const stops = -0.4;
    const nasals = -1.1;
    [31.5, 36, 41, 22, 36, 41, 22, 36, 41].forEach((angle, _index) => {
      const radius = _index < 4 ? fricatives : _index < 6 ? stops : nasals;

      this._drawText(angle, radius, phonemes[_index], false);
    });
  }

  _drawText(index, diameter, text, isStraight = true, normalize = true) {
    if (normalize) {
      index *= this._processor.tract.length / 44;
    }
    const angle = this._getAngle(index);
    const radius = this._getRadius(index, diameter);

    this._context.save();
    this._context.translate(
      this._getX(angle, radius),
      this._getY(angle, radius) + 2
    );

    if (!isStraight) this._context.rotate(angle - Math.PI / 2);

    this._context.fillText(text, 0, 0);
    this._context.restore();
  }
  _moveTo(index, diameter) {
    this.__to(index, diameter, true);
  }
  _lineTo(index, diameter) {
    this.__to(index, diameter, false);
  }
  __to(index, diameter, moveTo = true) {
    const wobble = this._getWobble(index);
    const angle = this._getAngle(index, diameter) + wobble;
    const radius = this._getRadius(index, diameter) + 100 * wobble;

    const x = this._getX(angle, radius);
    const y = this._getY(angle, radius);

    if (moveTo) this._context.moveTo(x, y);
    else this._context.lineTo(x, y);
  }

  _getX(angle, radius) {
    return this._tract.origin.x - radius * Math.cos(angle);
  }
  _getY(angle, radius) {
    return this._tract.origin.y - radius * Math.sin(angle);
  }

  _getAngle(index) {
    const angle =
      this._tract.angle.offset +
      (index * this._tract.angle.scale * Math.PI) /
      (this._processor.tract.lip.start - 1);
    return angle;
  }
  _getWobble(index) {
    var wobble =
      this._processor.tract.amplitude.max[this._processor.tract.length - 1] +
      this._processor.tract.nose.amplitude.max[
      this._processor.tract.nose.length - 1
      ];
    wobble *=
      (0.03 * Math.sin(2 * index - 50 * (Date.now() / 1000)) * index) /
      this._processor.tract.length;
    return wobble;
  }
  _getRadius(index, diameter) {
    var radius = this._tract.radius - this._tract.scale * diameter;

    return radius;
  }

  _getIndex(x, y) {
    var angle = Math.atan2(y, x);
    while (angle > 0) angle -= 2 * Math.PI;

    const index =
      ((Math.PI + angle - this._tract.angle.offset) *
        (this._processor.tract.lip.start - 1)) /
      (this._tract.angle.scale * Math.PI);
    return index;
  }

  _getDiameter(x, y) {
    const diameter =
      (this._tract.radius - Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))) /
      this._tract.scale;
    return diameter;
  }

  _getEventX(event) {
    const x =
      (event.pageX - event.target.offsetLeft) * this._tract.scalar -
      this._tract.origin.x;
    return x;
  }
  _getEventY(event) {
    const y =
      (event.pageY - event.target.offsetTop) * this._tract.scalar -
      this._tract.origin.y;
    return y;
  }

  _getEventPosition(event) {
    const x = this._getEventX(event);
    const y = this._getEventY(event);

    return {
      index: this._getIndex(x, y),
      diameter: this._getDiameter(x, y),
    };
  }

  // _setTongue(event, position) {
  //   Object.keys(position).forEach((parameterNameSuffix) => {
  //     event.target.dispatchEvent(
  //       new CustomEvent("setParameterTract", {
  //         bubbles: true,
  //         detail: {
  //           parameterName: "tongue." + parameterNameSuffix,
  //           newValue: position[parameterNameSuffix],
  //         },
  //       })
  //     );
  //   });
  // }

  _endEvent(event) {
    const touchIdentifier = event instanceof Touch ? event.identifier : -1;

    if (this._touchConstrictionIndices[touchIdentifier] !== undefined) {
      const constrictionIndex = this._touchConstrictionIndices[touchIdentifier];
      const isTongue = constrictionIndex == -1;

      if (isTongue) {
        // do nothing
      } else {
        event.target.dispatchEvent(
          new CustomEvent("removeConstriction", {
            bubbles: true,
            detail: {
              constrictionIndex: constrictionIndex,
              touchIdentifier: touchIdentifier,
            },
          })
        );
      }

      this._touchConstrictionIndices[touchIdentifier] = undefined;
    }
    this._updateJoystickPosition(this.leftStickX, this.leftStickY);
  }
}

Math.clamp = function (value, min = 0, max = 1) {
  return value < min ? min : value > max ? max : value;
}

export default TractUI;
