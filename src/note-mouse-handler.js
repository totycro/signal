const DRAG_POSITION = {
  LEFT_EDGE: 0,
  CENTER: 1,
  RIGHT_EDGE: 2
}

class PencilMouseHandler {
  constructor(container, listener) {
    this.container = container
    this.listener = listener
    bindAllMethods(this)
  }

  resetCursor() {
    this.container.style.cursor = "default"
  }

  onMouseDownNote(e) {
    this.dragPosition = {
      x: e.localX,
      y: e.localY,
      type: this.getDragPositionType(e.localX, e.target.getBounds().width)
    }
  }

  onMouseDown(e) { 
    if (e.target == this.container) {
      const p = this.container.globalToLocal(e.stageX, e.stageY)
      this.listener.onCreateNote({
        x: quantizer.floorX(p.x),
        y: quantizer.floorY(p.y),
        width: quantizer.unitX
      })
    }
  }

  onPressMoveNote(e) {
    const bounds = {
      x: e.target.x,
      y: e.target.y,
      width: e.target.getBounds().width,
      height: e.target.getBounds().height
    }
    const p = this.container.globalToLocal(e.stageX, e.stageY)
    const qx = quantizer.roundX(p.x)

    switch (this.dragPosition.type) {
      case DRAG_POSITION.LEFT_EDGE:
      // 右端を固定して長さを変更
      bounds.width = bounds.width + bounds.x - qx 
      bounds.x = qx
      break
      case DRAG_POSITION.RIGHT_EDGE:
      // 左端を固定して長さを変更
      bounds.width = qx - bounds.x
      break
      case DRAG_POSITION.CENTER:
      // 移動
      bounds.x = quantizer.roundX(p.x - this.dragPosition.x)
      bounds.y = quantizer.roundY(p.y - this.dragPosition.y) 
      break
    }

    this.listener.onResizeNote(e.target.noteId, bounds)
  }

  getDragPositionType(localX, noteWidth) {
    const edgeSize = Math.min(noteWidth / 3, 8)
    if (localX <= edgeSize) { return DRAG_POSITION.LEFT_EDGE }
    if (noteWidth - localX <= edgeSize) { return DRAG_POSITION.RIGHT_EDGE }
    return DRAG_POSITION.CENTER
  }

  onMouseMove(e) {
    const cpos = this.container.globalToLocal(e.stageX, e.stageY)
    const obj = this.container.getObjectUnderPoint(cpos.x, cpos.y) // too slow!
    if (obj instanceof NoteView) {
      const pos = obj.globalToLocal(e.stageX, e.stageY)
      const type = this.getDragPositionType(pos.x, obj.getBounds().width)
      switch (type) {
        case DRAG_POSITION.LEFT_EDGE:
        case DRAG_POSITION.RIGHT_EDGE: 
        this.setCursor("w-resize")
        break
        default:
        this.setCursor("move")
        break
      }
    } else {
      this.setCursor("default")
    }
  }

  setCursor(cursor) {
    const style = this.container.parent.canvas.parentNode.style
    if (style.cursor != cursor) {
      style.cursor = cursor
    }
  }
}

class SelectionMouseHandler {
  constructor(container, selectionView, listener) {
    this.container = container
    this.listener = listener
    this.selectionView = selectionView
    this.selectedNotes = []
    this.isMouseDown = false
  }

  get selectionRect() {
    const b = this.selectionView.getBounds()
    return new Rect({
      x: this.selectionView.x,
      y: this.selectionView.y,
      width: b.width,
      height: b.height
    })
  }

  set selectionRect(rect) {
    this.selectionView.x = rect.x
    this.selectionView.y = rect.y
    this.selectionView.setSize(rect.width, rect.height)
  }

  onMouseDown(e) { 
    this.isMouseDown = true
    this.start = this.container.globalToLocal(e.stageX, e.stageY)
    const clicked = this.selectionRect.containsPoint(this.start)
    if (!clicked) {
      // 選択範囲外でクリックした場合は選択範囲をリセット
      this.selectionView.fixed = false
      this.selectionView.visible = false
      this.selectionRect = {
        x: this.start.x,
        y: this.start.y,
        width: 0,
        height: 0
      }
      this.listener.onSelectNotes([])
    }

    this.dragOffset = { 
      x: this.start.x - this.selectionRect.x, 
      y: this.start.y - this.selectionRect.y 
    }
  }

  onMouseMove(e) {
    if (!this.isMouseDown) {
      return
    }
    this.selectionView.visible = true

    const loc = this.container.globalToLocal(e.stageX, e.stageY)
    const bounds = this.selectionRect
    if (this.selectionView.fixed) {
      // 確定済みの選択範囲をドラッグした場合はノートと選択範囲を移動
      const qx = quantizer.roundX(loc.x - this.dragOffset.x)
      const qy = quantizer.roundY(loc.y - this.dragOffset.y)

      this.listener.onMoveNotes(this.selectedNotes, {
        x: qx - bounds.x,
        y: qy - bounds.y
      })
      bounds.x = qx
      bounds.y = qy
    } else {
      // 選択範囲の変形
      const rect = Rect.fromPoints(this.start, loc)
      bounds.x = quantizer.roundX(rect.x)
      bounds.y = quantizer.roundY(rect.y)
      bounds.width = (quantizer.roundX(rect.x + rect.width) - bounds.x) || quantizer.unitX
      bounds.height = (quantizer.roundY(rect.y + rect.height) - bounds.y) || quantizer.unitY
    }
    this.selectionRect = bounds
  }

  onMouseUp(e) { 
    if (!this.selectionView.fixed) {
      this.selectionView.fixed = true
      this.selectedNotes = this.listener.notes.filter(n => new Rect(selection).containsPoint(n))
      this.listener.onSelectNotes(this.selectedNotes)
    } else if (!this.isMouseMoved) {
      this.listener.onClickNotes(this.selectedNotes, e)
    }
    this.isMouseDown = false
  }
}
