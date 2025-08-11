mapView = new ol.View({
  center: ol.proj.fromLonLat([-7.6, 33.6]),
  zoom: 6,
});

const osmTile = new ol.layer.Tile({
  title: "OpenStreetMap",
  type: "base",
  visible: true,
  source: new ol.source.OSM(),
});

const esriLayer = new ol.layer.Tile({
  title: "ESRI Satellite",
  type: "base",
  visible: false,
  source: new ol.source.XYZ({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attributions: "© Esri",
  }),
});

const esriStreets = new ol.layer.Tile({
  title: "ESRI Streets",
  type: "base",
  visible: false,
  source: new ol.source.XYZ({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  }),
});

const map = new ol.Map({
  target: "map",
  layers: [osmTile, esriLayer, esriStreets],
  view: mapView,
  controls: [],
});

const view = map.getView();

document.getElementById("zoom-in").addEventListener("click", () => {
  view.setZoom(view.getZoom() + 1);
});

document.getElementById("zoom-out").addEventListener("click", () => {
  view.setZoom(view.getZoom() - 1);
});

const layerSwitcher = new LayerSwitcher({
  activationMode: "click",
  startActive: false,
  tipLabel: "Couches",
});
map.addControl(layerSwitcher);

const mousePosition = new ol.control.MousePosition({
  projection: "EPSG:4326",
  coordinateFormat: (coordinate) =>
    ol.coordinate.format(coordinate, "{y}, {x}", 6),
  className: "custom-mouse-position",
  target: document.getElementById("mouse-coords"),
});
map.addControl(mousePosition);

map.addControl(new ol.control.ScaleLine({ bar: true, text: true }));

let drawInteraction = null;
const resultElement = document.getElementById("measurement-result");

const formatLength = (line) => {
  const length = ol.sphere.getLength(line);
  return length > 1000
    ? (length / 1000).toFixed(2) + " km"
    : length.toFixed(2) + " m";
};

const formatArea = (polygon) => {
  const area = ol.sphere.getArea(polygon);
  return area > 1000000
    ? (area / 1000000).toFixed(2) + " km²"
    : area.toFixed(2) + " m²";
};

const addMeasureInteraction = (type) => {
  if (drawInteraction) map.removeInteraction(drawInteraction);

  drawInteraction = new ol.interaction.Draw({
    source: new ol.source.Vector(),
    type,
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({ color: "blue", width: 2 }),
      fill: new ol.style.Fill({ color: "rgba(0, 0, 255, 0.1)" }),
    }),
  });

  map.addInteraction(drawInteraction);

  drawInteraction.on("drawend", (evt) => {
    const geom = evt.feature.getGeometry();
    resultElement.innerHTML =
      type === "LineString"
        ? "Distance : " + formatLength(geom)
        : "Surface : " + formatArea(geom);
    map.removeInteraction(drawInteraction);
  });
};

document.getElementById("measure-length").onclick = () => {
  resultElement.innerHTML = "Cliquez pour tracer une ligne…";
  addMeasureInteraction("LineString");
};

document.getElementById("measure-area").onclick = () => {
  resultElement.innerHTML = "Cliquez pour dessiner un polygone…";
  addMeasureInteraction("Polygon");
};

const drawSource = new ol.source.Vector();
const drawLayer = new ol.layer.Vector({
  source: drawSource,
  style: new ol.style.Style({
    fill: new ol.style.Fill({ color: "rgba(255, 255, 0, 0.3)" }),
    stroke: new ol.style.Stroke({ color: "#ffcc33", width: 2 }),
    image: new ol.style.Circle({
      radius: 7,
      fill: new ol.style.Fill({ color: "#ffcc33" }),
    }),
  }),
});
map.addLayer(drawLayer);

function setupDrawing(type) {
  if (drawInteraction) map.removeInteraction(drawInteraction);
  drawInteraction = new ol.interaction.Draw({ source: drawSource, type });
  map.addInteraction(drawInteraction);

  const controls = document.getElementById("drawing-controls");
  controls.style.display = "block";

  const finishBtn = document.getElementById("finish-draw");
  const undoBtn = document.getElementById("undo-draw");
  const cancelBtn = document.getElementById("cancel-draw");

  finishBtn.onclick = () => drawInteraction.finishDrawing();
  undoBtn.onclick = () => drawInteraction.removeLastPoint();
  cancelBtn.onclick = () => {
    map.removeInteraction(drawInteraction);
    controls.style.display = "none";
  };

  drawInteraction.on("drawend", () => {
    controls.style.display = "none";
    map.removeInteraction(drawInteraction);
  });
}

document.getElementById("draw-point").onclick = () => setupDrawing("Point");
document.getElementById("draw-line").onclick = () => setupDrawing("LineString");
document.getElementById("draw-polygon").onclick = () => setupDrawing("Polygon");

document.getElementById("clear-draw").onclick = () => {
  drawSource.clear();
  if (drawInteraction) map.removeInteraction(drawInteraction);
};

document.getElementById("print-map").onclick = () => {
  window.print();
};

const importSource = new ol.source.Vector();
const importLayer = new ol.layer.Vector({
  source: importSource,
  style: new ol.style.Style({
    fill: new ol.style.Fill({ color: "rgba(0, 255, 255, 0.2)" }),
    stroke: new ol.style.Stroke({ color: "#00FFFF", width: 2 }),
    image: new ol.style.Circle({
      radius: 6,
      fill: new ol.style.Fill({ color: "#00FFFF" }),
    }),
  }),
});
map.addLayer(importLayer);

const dataMainBtn = document.getElementById("data-main-button");
const dataDropdown = document.getElementById("data-dropdown");
dataMainBtn.onclick = () => dataDropdown.classList.toggle("hidden");

document.getElementById("import-geojson").onclick = () => {
  document.getElementById("file-geojson").click();
};

document.getElementById("file-geojson").addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const geojson = JSON.parse(e.target.result);
      const features = new ol.format.GeoJSON().readFeatures(geojson, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });
      importSource.clear();
      importSource.addFeatures(features);
      const extent = importSource.getExtent();
      if (!ol.extent.isEmpty(extent)) {
        map
          .getView()
          .fit(extent, { padding: [20, 20, 20, 20], duration: 1000 });
      } else {
        alert("Fichier chargé, mais aucune géométrie visible.");
      }
    } catch (err) {
      alert("Erreur de lecture du fichier GeoJSON.");
    }
  };
  reader.readAsText(file);
});

document.getElementById("import-shp").onclick = () => {
  document.getElementById("file-shp").click();
};

document.getElementById("file-shp").addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    shp(e.target.result)
      .then((geojson) => {
        const features = new ol.format.GeoJSON().readFeatures(geojson, {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        });
        importSource.clear();
        importSource.addFeatures(features);
        const extent = importSource.getExtent();
        if (!ol.extent.isEmpty(extent)) {
          map
            .getView()
            .fit(extent, { padding: [20, 20, 20, 20], duration: 1000 });
        } else {
          alert("Fichier chargé mais aucune géométrie visible.");
        }
      })
      .catch(() => alert("Erreur de lecture du fichier SHP."));
  };
  reader.readAsArrayBuffer(file);
});

document.getElementById("export-geojson").onclick = () => {
  const features = drawSource.getFeatures();
  if (features.length === 0) {
    alert("Aucune entité à exporter.");
    return;
  }

  const geojsonFormat = new ol.format.GeoJSON();
  const geojsonData = geojsonFormat.writeFeaturesObject(features, {
    featureProjection: "EPSG:3857",
    dataProjection: "EPSG:4326",
  });

  const blob = new Blob([JSON.stringify(geojsonData)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "export.geojson";
  link.click();
};

document.getElementById("export-shp").onclick = () => {
  alert(
    "Export SHP non encore implémenté. Utiliser GeoJSON ou CSV pour l'instant."
  );
};

document.getElementById("btn-search").addEventListener("click", () => {
  const lon = parseFloat(document.getElementById("input-lon").value);
  const lat = parseFloat(document.getElementById("input-lat").value);

  if (isNaN(lon) || isNaN(lat)) {
    alert("Veuillez entrer des coordonnées valides.");
    return;
  }

  const coord = ol.proj.fromLonLat([lon, lat]);
  map.getView().animate({ center: coord, zoom: 14 });
});
 // Ajout d'un marqueur
        L.marker(latlng)
          .addTo(map)
          .bindPopup(
            `Coordonnées :<br>Lat: ${y.toFixed(5)}<br>Lng: ${x.toFixed(5)}`
          )
          .openPopup();

        document.getElementById("search-form").style.display = "none";
      });

      ol.marker(latlng)
          .addTo(map)
          .bindPopup(
            `Coordonnées :<br>Lat: ${y.toFixed(5)}<br>Lng: ${x.toFixed(5)}`
          )
          .openPopup();

        document.getElementById("search-form").style.display = "none";
      });






      // Fonction pour charger une couche WFS avec popups
      function loadWFSLayer(url, style = {}) {
        return fetch(url)
          .then((response) => response.json())
          .then((data) =>
            ol.geoJSON(data, {
              style,
              onEachFeature: function (feature, layer) {
                layer.on("click", function () {
                  let popupContent =
                    '<strong>Données attributaires :</strong><br><table class="popup-table">';
                  for (let key in feature.properties) {
                    const value = feature.properties[key];
                    popupContent += `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`;
                  }
                  popupContent += "</table>";
                  layer.bindPopup(popupContent).openPopup();
                });
              },
            })
          );
      }